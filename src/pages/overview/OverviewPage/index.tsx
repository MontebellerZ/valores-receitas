import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import FormField from "../../../components/ui/FormField";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import styles from "./styles.module.scss";
import PageHeader from "../../../components/ui/PageHeader";
import MetricCard, { MetricGrid } from "../../../components/ui/MetricCard";
import Panel from "../../../components/ui/Panel";
import PaymentBadge from "../../../components/ui/PaymentBadge";
import { money, number as count, dateLabel } from "../../../utils/format";
import {
  balance,
  dateKey,
  periodStart,
  summarizeSales,
  type Period,
} from "../../../domain/overview";
import { ArrowRight, Eye, ShoppingBag } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Sale, CalculatedProduction } from "../../../domain/models";
import { remainingPackages } from "../../../domain/calculations";
import logoVertical from "../../../assets/brand/conta-de-chef-vertical.png";

type Props = {
  productions: CalculatedProduction[];
  sales: Sale[];
  recipeCount: number;
  marketCount: number;
  importAction: ReactNode;
  onViewSales: () => void;
  onViewProduction: (id?: string) => void;
};

export default function Overview({
  productions,
  sales,
  recipeCount,
  marketCount,
  importAction,
  onViewSales,
  onViewProduction,
}: Props) {
  const [period, setPeriod] = useState<Period>("all");
  const today = new Date();
  const end = dateKey(today);
  const start = periodStart(period, today);
  const inPeriod = (date: string) =>
    date ? (!start || date >= start) && date <= end : period === "all";
  const periodSales = sales.filter((sale) => inPeriod(sale.date));
  const periodProductions = productions.filter((production) =>
    inPeriod(production.date),
  );
  const actual = summarizeSales(periodSales);
  const actualProfit = balance(actual.revenue, actual.cost);
  const rows = periodProductions
    .map((production) => {
      const linkedSales = periodSales.filter(
        (sale) => sale.productionId === production.id,
      );
      const realized = summarizeSales(linkedSales);
      const soldPackages = sales
        .filter((sale) => sale.productionId === production.id)
        .reduce((total, sale) => total + sale.packages, 0);
      const price = production.expectedSalePrice ?? production.salePrice;
      const available = remainingPackages(production, soldPackages);
      return {
        ...production,
        realized,
        soldPackages,
        hasSales: linkedSales.length > 0,
        price,
        available,
        remainingRevenue: price * available,
        remainingCost: production.costPerPackage * available,
      };
    })
    .sort((first, second) => second.date.localeCompare(first.date));
  const planning = rows.reduce(
    (total, production) => ({
      packages: total.packages + production.packages,
      soldPackages: total.soldPackages + production.soldPackages,
      available: total.available + production.available,
      cost: total.cost + production.cost,
      losses: total.losses + production.losses,
      remainingRevenue: total.remainingRevenue + production.remainingRevenue,
      remainingCost: total.remainingCost + production.remainingCost,
      expectedRevenue:
        total.expectedRevenue + production.price * remainingPackages(production),
      referenceRevenue: total.referenceRevenue + production.revenue,
      referenceProfit: total.referenceProfit + production.profit,
    }),
    {
      packages: 0,
      soldPackages: 0,
      available: 0,
      cost: 0,
      losses: 0,
      remainingRevenue: 0,
      remainingCost: 0,
      expectedRevenue: 0,
      referenceRevenue: 0,
      referenceProfit: 0,
    },
  );
  const remainingProfit = balance(
    planning.remainingRevenue,
    planning.remainingCost,
  );
  const recentSales = periodSales
    .slice()
    .sort(
      (first, second) =>
        second.date.localeCompare(first.date) ||
        second.id.localeCompare(first.id),
    )
    .slice(0, 5);
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
        description={`${periodProductions.length} produções · ${periodSales.length} vendas · ${recipeCount} receitas · ${marketCount} insumos`}
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

      <MetricGrid aria-label="Resultados reais">
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
          caption={`${periodSales.filter((sale) => !sale.paid).length} vendas pendentes`}
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
          {rows.length ? (
            <div className={styles["overview-production-progress"]}>
              {rows.slice(0, 6).map((production) => {
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
          ) : (
            <EmptyState className={styles["overview-empty-brand"]}>
              <img src={logoVertical} alt="" width="548" height="309" />
              <p>Nenhuma produção registrada.</p>
            </EmptyState>
          )}
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
        {rows.length ? (
          <DataTable variant="sales"   ><thead>
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
                {rows.slice(0, 6).map((production) => {
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
                      <td data-sort-value={production.recipeName}>
                        <strong>{production.recipeName}</strong>
                        <small>{dateLabel(production.date)}</small>
                      </td>
                      <td data-sort-value={production.realized.packages}>{count(production.realized.packages)}</td>
                      <td data-sort-value={production.available}>{count(production.available)}</td>
                      <td data-sort-value={production.hasSales
                        ? production.realized.packages > 0 ? production.realized.revenue / production.realized.packages : null
                        : production.price}>
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
                      <td data-sort-value={revenue}>
                        {money(revenue)}
                        <small>{source}</small>
                      </td>
                      <td data-sort-value={production.hasSales || production.packages > 0 ? result : null}>
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
        ) : (
          <EmptyState>Nenhuma produção registrada.</EmptyState>
        )}
      </Panel>

      <Panel variant="plain" className={styles["overview-section"]} title="Vendas recentes" action={
          <Button variant="inline" onClick={onViewSales}>
            Ver vendas <ArrowRight size={14} aria-hidden="true" />
          </Button>
        }>
        {recentSales.length ? (
          <DataTable variant="sales"   ><thead>
                <tr>
                  <th>Venda</th>
                  <th>Cliente</th>
                  <th>Pacotes</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                </tr>
              </thead><tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td data-sort-value={sale.recipeName}>
                      <strong>{sale.recipeName}</strong>
                      <small>{dateLabel(sale.date)}</small>
                    </td>
                    <td data-sort-value={sale.customer}>{sale.customer || "—"}</td>
                    <td data-sort-value={sale.packages}>{count(sale.packages)}</td>
                    <td data-sort-value={sale.packages * sale.pricePerPackage}>{money(sale.packages * sale.pricePerPackage)}</td>
                    <td data-sort-value={Number(sale.paid)}>
                      <PaymentBadge paid={sale.paid} donated={sale.donated} />
                    </td>
                  </tr>
                ))}
              </tbody></DataTable>
        ) : (
          <EmptyState>Nenhuma venda registrada.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
