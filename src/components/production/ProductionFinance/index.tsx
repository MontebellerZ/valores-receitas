import type { CalculatedProduction } from "../../../domain/models";
import type { ProductionReport } from "../../../domain/productionReport";
import { money, number } from "../../../utils/format";
import Panel from "../../ui/Panel";
import styles from "./styles.module.scss";

export default function ProductionFinance({ production, report }: {
  production: CalculatedProduction;
  report: ProductionReport;
}) {
  const recovery = Math.min(100, report.costRecovery * 100);
  const missing = production.cost - report.revenue;
  const negative = (value: number) => (value < 0 ? styles.negative : undefined);

  return <Panel title="Resultado financeiro" description="Comparação entre o que foi investido e o que já entrou com as vendas.">
    <div className={styles.recovery}>
      <div className={styles["recovery-heading"]}>
        <span>Custo recuperado</span>
        <strong>{number(report.costRecovery * 100, 1)}%</strong>
      </div>
      <div className={styles.track} aria-hidden="true">
        <span className={report.costRecovery >= 1 ? styles.covered : undefined} style={{ width: `${recovery}%` }} />
      </div>
      <div className={styles["recovery-legend"]}>
        <span>{money(report.revenue)} faturados</span>
        <span>{money(production.cost)} investidos</span>
      </div>
      <p className={missing > 0 ? styles.warning : styles.success}>
        {production.cost === 0 ? "Produção sem custo registrado."
          : missing > 0 ? `Faltam ${money(missing)} em vendas para cobrir o custo.`
            : `Custo coberto! As vendas já geraram ${money(report.result)} de resultado.`}
      </p>
    </div>
    <dl className={styles.values}>
      <div><dt>Recebido</dt><dd>{money(report.received)}</dd></div>
      <div><dt>A receber</dt><dd className={report.pending > 0 ? styles.pending : undefined}>{money(report.pending)}</dd></div>
      <div><dt>Preço médio / pacote vendido</dt><dd>{report.soldPackages > 0 ? money(report.averagePrice) : "—"}</dd></div>
      <div><dt>Margem sobre o faturamento</dt><dd className={negative(report.result)}>{report.revenue > 0 ? `${number(report.margin * 100, 1)}%` : "—"}</dd></div>
      <div>
        <dt title="Faturamento menos o custo apenas dos pacotes que saíram">Lucro dos pacotes saídos</dt>
        <dd className={negative(report.salesResult)}>{money(report.salesResult)}</dd>
      </div>
      <div><dt>Custo de doações e perdas</dt><dd>{money(report.giveawayCost)}</dd></div>
    </dl>
    <div className={styles.projection}>
      <span className={styles["projection-title"]}>
        {report.availablePackages > 0
          ? `Se vender os ${number(report.availablePackages)} pacote(s) restantes a ${money(report.price)}`
          : "Resultado final da produção"}
      </span>
      <div>
        <div><small>Faturamento final</small><strong>{money(report.projectedRevenue)}</strong></div>
        <div><small>Resultado final</small><strong className={negative(report.projectedResult)}>{money(report.projectedResult)}</strong></div>
      </div>
    </div>
  </Panel>;
}
