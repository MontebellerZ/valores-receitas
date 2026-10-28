import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import SearchField from "../../../components/ui/SearchField";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import styles from "./styles.module.scss";
import PageHeader from "../../../components/ui/PageHeader";
import MetricCard, { MetricGrid } from "../../../components/ui/MetricCard";
import Panel from "../../../components/ui/Panel";
import PaymentBadge from "../../../components/ui/PaymentBadge";
import type { Sale, SalesProduction } from "../../../domain/models";
import { remainingPackages } from "../../../domain/calculations";
import { money, number as count, dateLabel } from "../../../utils/format";
import { useState } from "react";
import { Eye, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";

type Props = {
  productions: SalesProduction[];
  sales: Sale[];
  onCreate: () => void;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onViewProduction: (id: string) => void;
};

export default function Sales({
  productions,
  sales,
  onCreate,
  onEdit,
  onDelete,
  onViewProduction,
}: Props) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const soldPackages = (id: string) =>
    sales
      .filter((sale) => sale.productionId === id)
      .reduce((total, sale) => total + sale.packages, 0);
  const availablePackages = productions.reduce(
    (total, production) =>
      total + remainingPackages(production, soldPackages(production.id)),
    0,
  );
  const visibleSales = sales
    .filter(
      (sale) =>
        (!filter || sale.productionId === filter) &&
        `${sale.recipeName} ${sale.customer} ${sale.notes}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
    )
    .slice()
    .sort((first, second) => second.date.localeCompare(first.date));
  const totals = sales.reduce(
    (total, sale) => {
      const revenue = sale.packages * sale.pricePerPackage;
      return {
        revenue: total.revenue + revenue,
        received: total.received + (sale.paid ? revenue : 0),
        pending: total.pending + (sale.paid ? 0 : revenue),
        profit: total.profit + revenue - sale.packages * sale.costPerPackage,
      };
    },
    { revenue: 0, received: 0, pending: 0, profit: 0 },
  );

  return (
    <>
      <PageHeader
        title={<>Vendas</>}
        eyebrow={<>VENDAS REALIZADAS</>}
        description={`${sales.length} vendas registradas · ${count(availablePackages)} pacotes disponíveis`}
        action={
          <Button
            
            disabled={!availablePackages}
            onClick={onCreate}
          >
            <Plus size={17} aria-hidden="true" /> Registrar venda
          </Button>
        }
      />
      <MetricGrid aria-label="Resumo de vendas">
        <MetricCard
          label="Faturamento vendido"
          value={<>{money(totals.revenue)}</>}
          caption={<>Vendas registradas</>}
        />
        <MetricCard
          label="Recebido"
          value={<>{money(totals.received)}</>}
          caption={<>Valores recebidos</>}
        />
        <MetricCard
          label="A receber"
          value={<>{money(totals.pending)}</>}
          caption={<>Vendas com pagamento pendente</>}
        />
        <MetricCard
          label="Resultado das vendas"
          value={<>{money(totals.profit)}</>}
          caption={<>Menos ingredientes dos pacotes vendidos</>}
          negative={totals.profit < 0}
        />
      </MetricGrid>
      <Panel variant="plain" className={styles["sales-section"]} title="Saldo por produção">
        {productions.length ? (
          <DataTable variant="sales"   ><thead>
                <tr>
                  <th>Produção</th>
                  <th>Produzidos</th>
                  <th>Vendidos</th>
                  <th>Perdidos</th>
                  <th>Disponíveis</th>
                  <th />
                </tr>
              </thead><tbody>
                {productions
                  .slice()
                  .sort((first, second) =>
                    second.date.localeCompare(first.date),
                  )
                  .map((production) => {
                    const sold = soldPackages(production.id);
                    const lost = production.lostPackages ?? 0;
                    const available = remainingPackages(production, sold);
                    return (
                      <tr key={production.id}>
                        <td data-sort-value={production.recipeName}>
                          <strong>{production.recipeName}</strong>
                          <small>{dateLabel(production.date)}</small>
                        </td>
                        <td data-sort-value={production.packages}>{count(production.packages)}</td>
                        <td data-sort-value={sold}>{count(sold)}</td>
                        <td data-sort-value={lost}>{count(lost)}</td>
                        <td data-sort-value={available} className={styles["price-cell"]}>
                          {count(available)}
                        </td>
                        <td>
                          <IconButton
                            
                            aria-label={`Visualizar produção de ${production.recipeName} em ${production.date}`}
                            title="Visualizar produção"
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
          <EmptyState>
            <ShoppingBag size={26} aria-hidden="true" />
            <p>Nenhuma produção disponível para venda.</p>
          </EmptyState>
        )}
      </Panel>
      <Panel variant="plain" className={styles["sales-section"]} title="Histórico de vendas" action={
          <div className={styles["sales-filters"]}>
            <SearchableSelect
              className={styles["production-filter"]}
              aria-label="Filtrar vendas por produção"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "", label: "Todas as produções" },
                ...productions.map((production) => ({ value: production.id, label: `${production.recipeName} · ${dateLabel(production.date)}` })),
              ]}
            />
            <SearchField
              className={styles["sales-search"]}
              aria-label="Buscar vendas"
              placeholder="Buscar vendas..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        }>
        {visibleSales.length ? (
          <DataTable variant="sales"   ><thead>
                <tr>
                  <th>Venda / produção</th>
                  <th>Cliente</th>
                  <th>Pacotes</th>
                  <th>Preço / pacote</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                  <th>Ações</th>
                </tr>
              </thead><tbody>
                {visibleSales.map((sale) => (
                  <tr key={sale.id}>
                    <td data-sort-value={sale.recipeName}>
                      <strong>{sale.recipeName}</strong>
                      <small>
                        Venda: {dateLabel(sale.date)} · produção:{" "}
                        {dateLabel(sale.productionDate)}
                      </small>
                      {sale.notes && (
                        <small className={styles["sales-notes"]}>{sale.notes}</small>
                      )}
                    </td>
                    <td data-sort-value={sale.customer}>{sale.customer || "—"}</td>
                    <td data-sort-value={sale.packages}>{count(sale.packages)}</td>
                    <td data-sort-value={sale.pricePerPackage}>{money(sale.pricePerPackage)}</td>
                    <td data-sort-value={sale.packages * sale.pricePerPackage} className={styles["price-cell"]}>
                      {money(sale.packages * sale.pricePerPackage)}
                    </td>
                    <td data-sort-value={Number(sale.paid)}>
                      <PaymentBadge paid={sale.paid} donated={sale.donated} />
                    </td>
                    <td>
                      <div className={styles["sales-row-actions"]}>
                        <IconButton
                          
                          title="Editar venda"
                          aria-label={`Editar venda de ${sale.recipeName} para ${sale.customer || "cliente não informado"}`}
                          onClick={() => onEdit(sale)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          danger
                          title="Excluir venda"
                          aria-label={`Excluir venda de ${sale.recipeName} para ${sale.customer || "cliente não informado"}`}
                          onClick={() => onDelete(sale)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody></DataTable>
        ) : (
          <EmptyState>
            {sales.length
              ? "Nenhuma venda encontrada para estes filtros."
              : "Nenhuma venda registrada."}
          </EmptyState>
        )}
      </Panel>
      {!productions.length && (
        <Button
          variant="secondary"
          onClick={() => onViewProduction("")}
        >
          Ir para produção
        </Button>
      )}
    </>
  );
}
