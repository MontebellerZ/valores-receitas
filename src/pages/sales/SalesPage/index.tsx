import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import Pagination from "../../../components/ui/Pagination";
import SearchField from "../../../components/ui/SearchField";
import RemoteSelect from "../../../components/ui/RemoteSelect";
import styles from "./styles.module.scss";
import PageHeader from "../../../components/ui/PageHeader";
import Panel from "../../../components/ui/Panel";
import PaymentBadge from "../../../components/ui/PaymentBadge";
import SalesOverview from "../../../components/sales/SalesOverview";
import FormField from "../../../components/ui/FormField";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import type { Production, ProductionBalance, Sale, SalesReport, WorkspaceSummary } from "../../../domain/models";
import type { Period } from "../../../domain/overview";
import type { DateRange } from "../../../services/query";
import type { ListControls } from "../../../hooks/usePagedQuery";
import { queryService } from "../../../services/query";
import { money, number as count, dateLabel } from "../../../utils/format";
import { Eye, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useRef } from "react";
import type { Resource } from "../../../hooks/useResource";


type Props = {
  report: { data?: SalesReport; status: Resource<SalesReport>["status"]; pagination: ListControls["pagination"] };
  period: Period;
  onPeriodChange: (period: Period) => void;
  range: DateRange;
  payment: string;
  onPaymentChange: (payment: string) => void;
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
  report,
  period,
  onPeriodChange,
  range,
  payment,
  onPaymentChange,
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
  const historyRef = useRef<HTMLElement>(null);
  const availablePackages = summary?.availablePackages ?? 0;
  const productionCount = summary?.counts.productions ?? 0;
  const salesCount = summary?.counts.sales ?? 0;

  return (
    <>
      <PageHeader
        title={<>Vendas</>}
        eyebrow="DESEMPENHO E RESULTADOS"
        eyebrowDot
        description={summary
          ? `${count(salesCount)} registros no histórico · ${count(availablePackages)} pacotes disponíveis`
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
      <Panel className={styles.filters} title="Explore suas vendas" description="O período e a produção selecionados valem para os indicadores e o histórico.">
        <div className={styles["dashboard-filters"]}>
          <FormField label="Período">
            <SearchableSelect<Period> value={period} onChange={onPeriodChange} options={[
              { value: "week", label: "Últimos 7 dias" }, { value: "month", label: "Último mês" },
              { value: "six-months", label: "Últimos 6 meses" }, { value: "year", label: "Último ano" },
              { value: "all", label: "Desde sempre" },
            ]} />
          </FormField>
          <FormField label="Produção">
            <RemoteSelect
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
          </FormField>
          <span className={styles["range-label"]}>{range.from ? `${dateLabel(range.from)} a ${dateLabel(range.to ?? "")}` : `Todo o histórico até ${dateLabel(range.to ?? "")}`}</span>
        </div>
      </Panel>
      {report.status === "error" ? <Panel className={styles["sales-section"]}><p role="alert">Não foi possível carregar os indicadores de vendas. Recarregue a página para tentar novamente.</p></Panel>
        : report.data ? <SalesOverview report={report.data} pagination={report.pagination} onPending={() => {
          onPaymentChange("pending");
          historyRef.current?.focus({ preventScroll: true });
          historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }} />
          : <Panel className={styles["sales-section"]}><p role="status">Carregando indicadores de vendas...</p></Panel>}
      <Panel id="sales-history" ref={historyRef} tabIndex={-1} className={styles["sales-section"]} title="Histórico de vendas"
        description="Consulte vendas e doações. A busca e o pagamento abaixo filtram apenas este histórico."
        action={<SearchField className={styles["sales-search"]} aria-label="Buscar vendas" placeholder="Cliente, produto ou observação..."
          value={search} onChange={(event) => onSearch(event.target.value)} />}>
        <div className={styles["history-toolbar"]}>
          <div className={styles["payment-filters"]} role="group" aria-label="Filtrar histórico por pagamento">
            {[{ value: "", label: "Todos" }, { value: "paid", label: "Recebidos" }, { value: "pending", label: "A receber" },
              { value: "donated", label: "Doações" }].map((option) => <Button variant="text" key={option.value}
                aria-pressed={payment === option.value} onClick={() => onPaymentChange(option.value)}>{option.label}</Button>)}
          </div>
          <span>{count(sales.pagination.totalCount)} registro(s) encontrado(s)</span>
        </div>
        {sales.status === "loading" && <p role="status">Atualizando histórico de vendas...</p>}
        {sales.status === "error" ? <p role="alert">Não foi possível carregar o histórico de vendas.</p> : sales.items.length ? (
          <DataTable variant="sales" serverSort={sales.serverSort} aria-busy={sales.status === "loading"}><thead>
            <tr><th>Venda / produção</th><th>Cliente</th><th>Pacotes</th><th>Preço / pacote</th><th>Total</th><th>Pagamento</th><th>Ações</th></tr>
          </thead><tbody>{sales.items.map((sale) => <tr key={sale.id}>
            <td><strong>{sale.recipeName}</strong><small>Venda: {dateLabel(sale.date)} · produção: {dateLabel(sale.productionDate)}</small>
              {sale.notes && <small className={styles["sales-notes"]}>{sale.notes}</small>}</td>
            <td>{sale.customer || "—"}</td><td>{count(sale.packages)}</td><td>{money(sale.pricePerPackage)}</td>
            <td className={styles["price-cell"]}>{money(sale.packages * sale.pricePerPackage)}</td>
            <td><PaymentBadge paid={sale.paid} donated={sale.donated} /></td>
            <td><div className={styles["sales-row-actions"]}>
              <IconButton title="Visualizar produção" aria-label={`Visualizar produção de ${sale.recipeName}`}
                onClick={() => onViewProduction(sale.productionId)}><Eye size={16} aria-hidden="true" /></IconButton>
              <IconButton title="Editar venda" aria-label={`Editar venda de ${sale.recipeName} para ${sale.customer || "cliente não informado"}`}
                onClick={() => onEdit(sale)}><Pencil size={16} aria-hidden="true" /></IconButton>
              <IconButton danger title="Excluir venda" aria-label={`Excluir venda de ${sale.recipeName} para ${sale.customer || "cliente não informado"}`}
                onClick={() => onDelete(sale)}><Trash2 size={16} aria-hidden="true" /></IconButton>
            </div></td>
          </tr>)}</tbody></DataTable>
        ) : sales.status === "ready" && <EmptyState>{salesCount
          ? "Nenhuma venda encontrada para estes filtros." : "Nenhuma venda registrada. Registre sua primeira venda para acompanhar os resultados."}</EmptyState>}
        {sales.pagination.totalCount > 0 && <Pagination {...sales.pagination} label="vendas" />}
      </Panel>
      <details className={styles["balance-details"]}>
        <summary><ShoppingBag size={18} aria-hidden="true" /><span>Disponível para vender<small>Saldo atual de todas as produções, independente do período</small></span><strong>{summary ? `${count(availablePackages)} pacotes` : "Carregando..."}</strong></summary>
      <Panel className={styles["sales-section"]} title="Saldo por produção">
        {balances.status === "loading" && <p role="status">Atualizando saldo das produções...</p>}
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
      </details>
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
