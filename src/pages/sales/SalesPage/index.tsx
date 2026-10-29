import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import Pagination from "../../../components/ui/Pagination";
import SearchField from "../../../components/ui/SearchField";
import RemoteSelect from "../../../components/ui/RemoteSelect";
import styles from "./styles.module.scss";
import PageHeader from "../../../components/ui/PageHeader";
import MetricCard, { MetricGrid } from "../../../components/ui/MetricCard";
import Panel from "../../../components/ui/Panel";
import PaymentBadge from "../../../components/ui/PaymentBadge";
import type { Production, ProductionBalance, Sale, WorkspaceSummary } from "../../../domain/models";
import type { ListControls } from "../../../hooks/usePagedQuery";
import { queryService } from "../../../services/query";
import { money, number as count, dateLabel } from "../../../utils/format";
import { Eye, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";


type Props = {
  /** Global totals computed by the server; `undefined` while loading. */
  summary?: WorkspaceSummary | null;
  /** Current page of production balances (sold/available computed on the server). */
  balances: ListControls & { items: ProductionBalance[] };
  /** Current page of the sales history for the filters below. */
  sales: ListControls & { items: Sale[] };
  productionFilter: { id: string; label?: string };
  onProductionFilter: (id: string, label?: string) => void;
  search: string;
  onSearch: (search: string) => void;
  version?: number;
  onCreate: () => void;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onViewProduction: (id: string) => void;
};

const productionLabel = (production: Pick<Production, "recipeName" | "date">) =>
  `${production.recipeName} · ${dateLabel(production.date)}`;

export default function Sales({
  summary,
  balances,
  sales,
  productionFilter,
  onProductionFilter,
  search,
  onSearch,
  version,
  onCreate,
  onEdit,
  onDelete,
  onViewProduction,
}: Props) {
  const totals = summary?.sales;
  const availablePackages = summary?.availablePackages ?? 0;
  const productionCount = summary?.counts.productions ?? 0;
  const salesCount = summary?.counts.sales ?? 0;

  return (
    <>
      <PageHeader
        title={<>Vendas</>}
        eyebrow={<>VENDAS REALIZADAS</>}
        description={summary
          ? `${count(salesCount)} vendas registradas · ${count(availablePackages)} pacotes disponíveis`
          : "Carregando resumo das vendas..."}
        action={
          <Button
            disabled={!availablePackages}
            onClick={onCreate}
          >
            <Plus size={17} aria-hidden="true" /> Registrar venda
          </Button>
        }
      />
      <MetricGrid aria-label="Resumo de vendas" aria-busy={!summary}>
        <MetricCard
          label="Faturamento vendido"
          value={<>{money(totals?.revenue ?? 0)}</>}
          caption={<>Vendas registradas</>}
        />
        <MetricCard
          label="Recebido"
          value={<>{money(totals?.received ?? 0)}</>}
          caption={<>Valores recebidos</>}
        />
        <MetricCard
          label="A receber"
          value={<>{money(totals?.pending ?? 0)}</>}
          caption={<>Vendas com pagamento pendente</>}
        />
        <MetricCard
          label="Resultado das vendas"
          value={<>{money(totals?.profit ?? 0)}</>}
          caption={<>Menos ingredientes dos pacotes vendidos</>}
          negative={(totals?.profit ?? 0) < 0}
        />
      </MetricGrid>
      <Panel variant="plain" className={styles["sales-section"]} title="Saldo por produção">
        {balances.items.length ? (
          <DataTable variant="sales" serverSort={balances.serverSort} aria-busy={balances.status === "loading"}><thead>
                <tr>
                  <th>Produção</th>
                  <th>Produzidos</th>
                  <th>Vendidos</th>
                  <th>Perdidos</th>
                  <th>Disponíveis</th>
                  <th />
                </tr>
              </thead><tbody>
                {balances.items.map((production) => (
                  <tr key={production.id}>
                    <td>
                      <strong>{production.recipeName}</strong>
                      <small>{dateLabel(production.date)}</small>
                    </td>
                    <td>{count(production.packages)}</td>
                    <td>{count(production.soldPackages)}</td>
                    <td>{count(production.lostPackages ?? 0)}</td>
                    <td className={styles["price-cell"]}>{count(production.availablePackages)}</td>
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
                ))}
              </tbody></DataTable>
        ) : balances.status === "error" ? (
          <EmptyState>Não foi possível carregar o saldo das produções.</EmptyState>
        ) : balances.status === "ready" && (
          <EmptyState>
            <ShoppingBag size={26} aria-hidden="true" />
            <p>Nenhuma produção disponível para venda.</p>
          </EmptyState>
        )}
        {balances.pagination.totalCount > 0 && <Pagination {...balances.pagination} label="produções" />}
      </Panel>
      <Panel variant="plain" className={styles["sales-section"]} title="Histórico de vendas" action={
          <div className={styles["sales-filters"]}>
            <RemoteSelect
              className={styles["production-filter"]}
              aria-label="Filtrar vendas por produção"
              value={productionFilter.id}
              selectedLabel={productionFilter.id ? productionFilter.label : "Todas as produções"}
              fetcher={queryService.productions}
              sortBy="date"
              descending
              version={version}
              staticOptions={[{ value: "", label: "Todas as produções" }]}
              toOption={(production: Production) => ({ value: production.id, label: productionLabel(production) })}
              onChange={(id, production) => onProductionFilter(id, production && productionLabel(production))}
            />
            <SearchField
              className={styles["sales-search"]}
              aria-label="Buscar vendas"
              placeholder="Buscar vendas..."
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
        }>
        {sales.items.length ? (
          <DataTable variant="sales" serverSort={sales.serverSort} aria-busy={sales.status === "loading"}><thead>
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
                {sales.items.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <strong>{sale.recipeName}</strong>
                      <small>
                        Venda: {dateLabel(sale.date)} · produção:{" "}
                        {dateLabel(sale.productionDate)}
                      </small>
                      {sale.notes && (
                        <small className={styles["sales-notes"]}>{sale.notes}</small>
                      )}
                    </td>
                    <td>{sale.customer || "—"}</td>
                    <td>{count(sale.packages)}</td>
                    <td>{money(sale.pricePerPackage)}</td>
                    <td className={styles["price-cell"]}>
                      {money(sale.packages * sale.pricePerPackage)}
                    </td>
                    <td>
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
        ) : sales.status === "error" ? (
          <EmptyState>Não foi possível carregar o histórico de vendas.</EmptyState>
        ) : sales.status === "ready" && (
          <EmptyState>
            {salesCount
              ? "Nenhuma venda encontrada para estes filtros."
              : "Nenhuma venda registrada."}
          </EmptyState>
        )}
        {sales.pagination.totalCount > 0 && <Pagination {...sales.pagination} label="vendas" />}
      </Panel>
      {summary && !productionCount && (
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
