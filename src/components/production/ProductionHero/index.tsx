import type { ReactNode } from "react";
import type { CalculatedProduction } from "../../../domain/models";
import type { ProductionReport, ProductionStatus } from "../../../domain/productionReport";
import { dateLabel, money, number } from "../../../utils/format";
import Icon from "../../ui/Icon";
import styles from "./styles.module.scss";

const statuses: Record<ProductionStatus, { label: string; className: string }> = {
  "no-packages": { label: "Sem pacotes", className: styles["status-empty"] },
  waiting: { label: "Aguardando vendas", className: styles["status-waiting"] },
  selling: { label: "Em venda", className: styles["status-selling"] },
  closed: { label: "Encerrada", className: styles["status-closed"] },
};

export default function ProductionHero({ production, report, expiresOn, actions }: {
  production: CalculatedProduction;
  report: ProductionReport;
  /** Data de vencimento (ISO) calculada pela validade da receita; apenas informativa. */
  expiresOn?: string | null;
  actions?: ReactNode;
}) {
  const status = statuses[report.status];
  return <section className={styles.hero} aria-labelledby="production-hero-title">
    <div className={styles.top}>
      <div className={styles.identity}>
        <span className={styles.badge} aria-hidden="true"><Icon name="recipe" size={22} /></span>
        <div>
          <p className={styles.eyebrow}>
            {production.isStandalone ? "Produção avulsa" : "Produção"} · {dateLabel(production.date)}
          </p>
          <h1 id="production-hero-title">{production.recipeName}</h1>
          <div className={styles.tags}>
            <span className={[styles.status, status.className].join(" ")}>{status.label}</span>
            {expiresOn && <span className={styles.expiry}>Vence em {dateLabel(expiresOn)}</span>}
          </div>
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
    <dl className={styles.kpis}>
      <div>
        <dt>Custo da produção</dt>
        <dd>{money(production.cost)}</dd>
        <small>{production.packages > 0 ? `${money(production.costPerPackage)} por pacote` : "Sem pacotes formados"}</small>
      </div>
      <div>
        <dt>Pacotes saídos</dt>
        <dd>{number(report.outPackages)} <span>/ {number(production.packages)}</span></dd>
        <small>{number(report.availablePackages)} disponível(is) para venda</small>
      </div>
      <div>
        <dt>Faturamento</dt>
        <dd>{money(report.revenue)}</dd>
        <small>{report.pending > 0 ? `${money(report.pending)} a receber`
          : report.revenue > 0 ? "Tudo recebido" : "Nenhuma venda ainda"}</small>
      </div>
      <div>
        <dt>Resultado atual</dt>
        <dd className={report.result < 0 ? styles.negative : styles.positive}>{money(report.result)}</dd>
        <small>{number(report.costRecovery * 100, 1)}% do custo recuperado</small>
      </div>
    </dl>
  </section>;
}
