import { ArrowDownLeft, ArrowUpRight, Gift, ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import type { SalesReport } from "../../../domain/models";
import { balance } from "../../../domain/overview";
import type { ListControls } from "../../../hooks/usePagedQuery";
import { dateLabel, money, number } from "../../../utils/format";
import Panel from "../../ui/Panel";
import Pagination from "../../ui/Pagination";
import DataTable from "../../ui/DataTable";
import Button from "../../ui/Button";
import styles from "./styles.module.scss";

type Props = {
  report: SalesReport;
  pagination: ListControls["pagination"];
  onPending: () => void;
};

const percent = (value: number) => `${number(value, 1)}%`;
const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
});

export default function SalesOverview({ report, pagination, onPending }: Props) {
  const { totals, daily, topProducts, topBuyers } = report;
  const result = balance(totals.revenue, totals.cost);
  const netResult = balance(totals.revenue, totals.cost + totals.donationCost);
  const margin = totals.revenue > 0 ? result / totals.revenue * 100 : null;
  const receivedPercent = totals.revenue > 0 ? totals.received / totals.revenue * 100 : 0;
  const days = daily.items;
  const max = Math.max(1, ...days.map((day) => day.revenue));
  const band = 564 / Math.max(1, days.length);
  const barWidth = Math.min(34, band * 0.65);
  const best = days.reduce<(typeof days)[number] | undefined>((current, day) =>
    !current || day.revenue > current.revenue ? day : current, undefined);
  return <>
    <section className={styles.hero} aria-label="Resultados de vendas do período">
      <div className={styles["hero-heading"]}>
        <div>
          <span className={styles.eyebrow}><TrendingUp size={15} aria-hidden="true" /> PANORAMA DE VENDAS</span>
          <p>Vendas realizadas no período, incluindo as que ainda não foram pagas.</p>
        </div>
        <ShoppingBag className={styles["hero-icon"]} size={38} aria-hidden="true" />
      </div>
      <dl className={styles.kpis}>
        <div><dt>Faturamento vendido</dt><dd>{money(totals.revenue)}</dd>
          <small>{number(totals.count)} venda(s) no período</small></div>
        <div><dt>Resultado das vendas</dt>
          <dd className={result < 0 ? styles.negative : styles.positive}>{money(result)}</dd>
          <small>{margin === null ? "Sem faturamento para calcular a margem" : `${percent(margin)} de margem sobre as vendas`}</small></div>
        <div><dt>Ticket médio</dt><dd>{totals.count ? money(totals.revenue / totals.count) : "—"}</dd>
          <small>Valor médio por registro de venda</small></div>
        <div><dt>Pacotes vendidos</dt><dd>{number(totals.packages)}</dd>
          <small>{totals.packages ? `${money(totals.revenue / totals.packages)} por pacote, em média` : "Aguardando a primeira venda"}</small></div>
      </dl>
      <div className={styles["hero-footer"]}>
        <span><Users size={15} aria-hidden="true" /> {number(totals.customers)} cliente(s) identificado(s)</span>
        <span><Gift size={15} aria-hidden="true" /> {number(totals.donatedPackages)} pacote(s) doado(s), fora das vendas</span>
      </div>
    </section>

    <div className={styles["main-grid"]}>
      <Panel title="Ritmo das vendas" description="Faturamento por dia de venda. Os dias sem vendas não são exibidos.">
        {days.length ? <>
          {best && <div className={styles["chart-summary"]}>
            <span>Maior faturamento nesta página</span>
            <strong>{money(best.revenue)} <small>em {dateLabel(best.date)}</small></strong>
          </div>}
          <figure className={styles.chart}>
            <svg viewBox="0 0 640 230" role="img" aria-label={`Faturamento diário: ${days.length} dia(s) nesta página. Valores detalhados disponíveis abaixo do gráfico.`}>
              {[0, 0.5, 1].map((ratio) => <g key={ratio}>
                <line className={styles.grid} x1={60} x2={624} y1={184 - ratio * 158} y2={184 - ratio * 158} />
                <text className={styles.axis} x={52} y={188 - ratio * 158} textAnchor="end">{compactMoney.format(max * ratio)}</text>
              </g>)}
              {days.map((day, index) => {
                const x = 60 + band * index + (band - barWidth) / 2;
                const height = day.revenue / max * 158;
                return <g key={day.date}>
                  <title>{`${dateLabel(day.date)}: ${money(day.revenue)} · ${number(day.packages)} pacotes vendidos`}</title>
                  <rect className={styles.bar} x={x} y={184 - height} width={barWidth} height={height} rx={3} />
                  {index % Math.max(1, Math.ceil(days.length / 6)) === 0 &&
                    <text className={styles.axis} x={x + barWidth / 2} y={207} textAnchor="middle">{day.date.slice(5).split("-").reverse().join("/")}</text>}
                </g>;
              })}
            </svg>
          </figure>
          <details className={styles["daily-details"]}>
            <summary>Ver valores por dia</summary>
            <DataTable><thead><tr><th>Data</th><th>Pacotes vendidos</th><th>Faturamento</th></tr></thead>
              <tbody>{days.map((day) => <tr key={day.date}><td>{dateLabel(day.date)}</td><td>{number(day.packages)}</td><td>{money(day.revenue)}</td></tr>)}</tbody>
            </DataTable>
          </details>
          {daily.totalPages > 1 && <Pagination {...pagination} label="dias com vendas" />}
        </> : <div className={styles.empty}><TrendingUp size={28} aria-hidden="true" />
          <strong>O próximo resultado começa com uma venda</strong><p>Não há vendas neste período. Experimente outro período ou registre uma nova venda.</p></div>}
      </Panel>

      <Panel title="Do vendido ao recebido" description="Acompanhe os pagamentos das vendas deste período.">
        <div className={styles["collection-total"]}><Wallet size={19} aria-hidden="true" />
          <strong>{percent(receivedPercent)}</strong><span>do faturamento já recebido</span></div>
        <progress className={styles.progress} max={100} value={receivedPercent} aria-label="Percentual do faturamento recebido" />
        <dl className={styles.finance}>
          <div><dt><ArrowDownLeft size={16} aria-hidden="true" /> Recebido</dt><dd>{money(totals.received)}</dd></div>
          <div><dt><ArrowUpRight size={16} aria-hidden="true" /> A receber <small>{number(totals.pendingCount)} venda(s) pendente(s)</small></dt><dd>{money(totals.pending)}</dd></div>
        </dl>
        {totals.pendingCount > 0 && <Button variant="text" className={styles["pending-link"]} onClick={onPending}>
          Consultar pagamentos pendentes <ArrowUpRight size={15} aria-hidden="true" /></Button>}
        <div className={styles.breakdown}>
          <h3>Entenda o resultado</h3>
          <dl className={styles.finance}>
            <div><dt>Faturamento</dt><dd>{money(totals.revenue)}</dd></div>
            <div><dt>Custo dos pacotes vendidos</dt><dd>− {money(totals.cost)}</dd></div>
            <div><dt>Custo das doações</dt><dd>− {money(totals.donationCost)}</dd></div>
            <div className={styles["net-result"]}><dt>Resultado após doações</dt><dd className={netResult < 0 ? styles.loss : styles.gain}>{money(netResult)}</dd></div>
          </dl>
          <p>Custos registrados na produção, proporcionais aos pacotes. Não inclui outras despesas do negócio. Resultado não é saldo em caixa.</p>
        </div>
      </Panel>
    </div>

    <div className={styles.rankings}>
      <Panel title="Produtos que mais faturam" description="Top 5 por faturamento, somando todas as produções do período.">
        {topProducts.length ? <ol className={styles.ranking}>{topProducts.map((item, index) => <li key={item.name}>
          <span className={styles.position}>{index + 1}</span>
          <div className={styles["rank-content"]}><div className={styles["rank-heading"]}><strong>{item.name}</strong><b>{money(item.revenue)}</b></div>
            <div className={styles.track}><span style={{ width: `${totals.revenue > 0 ? item.revenue / totals.revenue * 100 : 0}%` }} /></div>
            <small>{number(item.packages)} pacotes · {totals.revenue > 0 ? `${percent(item.revenue / totals.revenue * 100)} do faturamento · ` : ""}resultado {money(balance(item.revenue, item.cost))}</small>
          </div>
        </li>)}</ol> : <p className={styles["empty-ranking"]}>Os produtos aparecerão aqui quando houver vendas no período.</p>}
      </Panel>
      <Panel title="Clientes em destaque" description="Top 5 por valor comprado. Inclui compras ainda não pagas; não inclui doações.">
        {topBuyers.length ? <ol className={styles.ranking}>{topBuyers.map((item, index) => <li key={item.customer}>
          <span className={styles.position}>{index + 1}</span>
          <div className={styles["rank-content"]}><div className={styles["rank-heading"]}><strong>{item.customer || "Cliente não informado"}</strong><b>{money(item.spent)}</b></div>
            <small>{number(item.packages)} pacote(s) comprado(s)</small>
          </div>
        </li>)}</ol> : <p className={styles["empty-ranking"]}>Os clientes aparecerão aqui quando houver vendas no período.</p>}
        <p className={styles.footnote}>Nomes iguais são agrupados. Vendas sem cliente formam um único grupo e não entram na contagem de clientes identificados.</p>
      </Panel>
    </div>
  </>;
}
