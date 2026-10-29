import Button from "../../ui/Button";
import DataTable from "../../ui/DataTable";
import EmptyState from "../../ui/EmptyState";
import Pagination from "../../ui/Pagination";
import styles from "./styles.module.scss";
import PaymentBadge from "../../ui/PaymentBadge";
import Panel from "../../ui/Panel";
import MetricCard, { MetricGrid } from "../../ui/MetricCard";
import type { ProductionSale } from "../../../domain/models";
import type { ProductionReport } from "../../../domain/productionReport";
import type { ListControls } from "../../../hooks/usePagedQuery";
import { balance } from "../../../domain/overview";
import { money, number } from "../../../utils/format";
import Icon from "../../ui/Icon";


export default function RealizedSales({
  report,
  sales,
  onViewSales,
}: {
  /** Totals of every sale of the production, aggregated by the server. */
  report: Pick<ProductionReport, "outPackages" | "availablePackages" | "revenue" | "received" | "pending" | "soldCost">;
  /** Current page of the production's sales history. */
  sales: ListControls & { items: ProductionSale[] };
  onViewSales: () => void;
}) {
  const profit = balance(report.revenue, report.soldCost);
  return (
    <Panel variant="inset" title="Venda realizada" action={
        <Button variant="inline" onClick={onViewSales}>
          Ver vendas <Icon name="arrow" size={14} />
        </Button>
      }>
      <MetricGrid variant="simulation" aria-label="Resultados das vendas" aria-live="polite">
        <MetricCard variant="compact" label="Pacotes vendidos" value={number(report.outPackages)} />
        <MetricCard variant="compact" label="Pacotes disponíveis" value={number(report.availablePackages)} />
        <MetricCard variant="compact" label="Faturamento vendido" value={money(report.revenue)} />
        <MetricCard variant="compact" label="Recebido" value={money(report.received)} />
        <MetricCard variant="compact" label="A receber" value={money(report.pending)} />
        <MetricCard variant="compact" label={<span title="Faturamento vendido menos o custo histórico de ingredientes dos pacotes vendidos">Resultado das vendas</span>}
          value={money(profit)} negative={profit < 0} caption={<>Custo dos vendidos: {money(report.soldCost)}</>} />
      </MetricGrid>
      {sales.items.length ? (
        <DataTable variant="sales" containerClassName={styles["realized-sales-history"]} serverSort={sales.serverSort}
          aria-busy={sales.status === "loading"}><thead>
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
              {sales.items.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(`${sale.date}T12:00:00`),
                    )}
                  </td>
                  <td>{sale.customer || "—"}</td>
                  <td>{number(sale.packages)}</td>
                  <td>{money(sale.pricePerPackage)}</td>
                  <td className={styles["price-cell"]}>{money(sale.packages * sale.pricePerPackage)}</td>
                  <td>{money(sale.cumulativeRevenue)}</td>
                  <td>
                    <PaymentBadge paid={sale.paid} donated={sale.donated} />
                  </td>
                </tr>
              ))}
            </tbody></DataTable>
      ) : sales.status === "error" ? (
        <EmptyState>Não foi possível carregar o histórico de vendas.</EmptyState>
      ) : sales.status === "ready" && (
        <EmptyState>
          Nenhuma venda registrada para esta produção.
        </EmptyState>
      )}
      <Pagination {...sales.pagination} label="vendas da produção" />
    </Panel>
  );
}
