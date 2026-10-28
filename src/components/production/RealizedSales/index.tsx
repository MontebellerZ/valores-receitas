import Button from "../../ui/Button";
import DataTable from "../../ui/DataTable";
import EmptyState from "../../ui/EmptyState";
import styles from "./styles.module.scss";
import PaymentBadge from "../../ui/PaymentBadge";
import Panel from "../../ui/Panel";
import MetricCard, { MetricGrid } from "../../ui/MetricCard";
import type { CalculatedProduction, Sale } from "../../../domain/models";
import { remainingPackages } from "../../../domain/calculations";
import { balance, summarizeSales } from "../../../domain/overview";
import { money, number } from "../../../utils/format";
import Icon from "../../ui/Icon";

export default function RealizedSales({
  production,
  sales,
  onViewSales,
}: {
  production: CalculatedProduction;
  sales: Sale[];
  onViewSales: () => void;
}) {
  const linkedSales = sales
    .filter((sale) => sale.productionId === production.id)
    .slice()
    .sort(
      (first, second) =>
        first.date.localeCompare(second.date) ||
        first.id.localeCompare(second.id),
    );
  const totals = summarizeSales(linkedSales);
  const profit = balance(totals.revenue, totals.cost);
  const history = linkedSales.reduce<
    Array<{ sale: Sale; accumulated: number }>
  >((rows, sale) => {
    rows.push({
      sale,
      accumulated:
        (rows.at(-1)?.accumulated ?? 0) + sale.packages * sale.pricePerPackage,
    });
    return rows;
  }, []);

  return (
    <Panel variant="inset" title="Venda realizada" action={
        <Button variant="inline" onClick={onViewSales}>
          Ver vendas <Icon name="arrow" size={14} />
        </Button>
      }>
      <MetricGrid variant="simulation" aria-label="Resultados das vendas" aria-live="polite">
        <MetricCard variant="compact" label="Pacotes vendidos" value={number(totals.packages)} />
        <MetricCard variant="compact" label="Pacotes disponíveis" value={number(remainingPackages(production, totals.packages))} />
        <MetricCard variant="compact" label="Faturamento vendido" value={money(totals.revenue)} />
        <MetricCard variant="compact" label="Recebido" value={money(totals.received)} />
        <MetricCard variant="compact" label="A receber" value={money(totals.pending)} />
        <MetricCard variant="compact" label={<span title="Faturamento vendido menos o custo histórico de ingredientes dos pacotes vendidos">Resultado das vendas</span>}
          value={money(profit)} negative={profit < 0} caption={<>Custo dos vendidos: {money(totals.cost)}</>} />
      </MetricGrid>
      {history.length ? (
        <DataTable variant="sales"  containerClassName={styles["realized-sales-history"]} ><thead>
              <tr>
                <th>Data da venda</th>
                <th>Cliente</th>
                <th>Pacotes</th>
                <th>Preço / pacote</th>
                <th>Total</th>
                <th>Faturamento acumulado</th>
                <th>Pagamento</th>
              </tr>
            </thead><tbody>
              {history.map(({ sale, accumulated }) => (
                <tr key={sale.id}>
                  <td data-sort-value={sale.date}>
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(`${sale.date}T12:00:00`),
                    )}
                  </td>
                  <td data-sort-value={sale.customer}>{sale.customer || "—"}</td>
                  <td data-sort-value={sale.packages}>{number(sale.packages)}</td>
                  <td data-sort-value={sale.pricePerPackage}>{money(sale.pricePerPackage)}</td>
                  <td data-sort-value={sale.packages * sale.pricePerPackage}>{money(sale.packages * sale.pricePerPackage)}</td>
                  <td data-sort-value={accumulated} className={styles["price-cell"]}>{money(accumulated)}</td>
                  <td data-sort-value={Number(sale.paid)}>
                    <PaymentBadge paid={sale.paid} donated={sale.donated} />
                  </td>
                </tr>
              ))}
            </tbody></DataTable>
      ) : (
        <EmptyState>
          Nenhuma venda registrada para esta produção.
        </EmptyState>
      )}
    </Panel>
  );
}
