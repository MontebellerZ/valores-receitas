import type { CalculatedProduction } from "../../../domain/models";
import type { ProductionReport } from "../../../domain/productionReport";
import { money, number } from "../../../utils/format";
import Panel from "../../ui/Panel";
import styles from "./styles.module.scss";

export default function ProductionYield({ production, report }: {
  production: CalculatedProduction;
  report: ProductionReport;
}) {
  const scale = Math.max(report.expectedYield, production.actualYield, 1);
  const width = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const efficiency = report.yieldEfficiency * 100;
  const steps = [
    { label: "Rendimento esperado", value: report.expectedYield, unit: "un.",
      note: `${number(production.quantity, 4)} lote(s) × ${number(production.yieldPerBatch, 4)} un.`, className: styles.expected },
    { label: "Rendimento obtido", value: production.actualYield, unit: "un.",
      note: report.expectedYield > 0 ? `${number(efficiency, 1)}% do esperado` : "Sem referência", className: styles.actual },
    { label: "Perdas na produção", value: production.losses, unit: "un.",
      note: `${number(report.lossRate * 100, 1)}% do obtido`, className: styles.losses },
    { label: "Rendimento líquido", value: production.produced, unit: "un.",
      note: report.leftoverUnits > 0 ? `${number(report.leftoverUnits, 4)} un. não completam um pacote` : "Todo aproveitado em pacotes",
      className: styles.net },
  ];

  return <Panel title="Rendimento da produção"
    description={report.expectedYield > 0 ? efficiency >= 100 ? "Rendeu o esperado ou mais." : "Rendeu abaixo do esperado." : undefined}>
    <ol className={styles.steps}>
      {steps.map((step) => <li key={step.label}>
        <div className={styles.heading}>
          <span>{step.label}</span>
          <strong>{number(step.value, 4)} {step.unit}</strong>
        </div>
        <div className={styles.track} aria-hidden="true">
          <span className={step.className} style={{ width: width(step.value) }} />
        </div>
        <small>{step.note}</small>
      </li>)}
    </ol>
    <div className={styles.packages}>
      <div>
        <span>Pacotes formados</span>
        <strong>{number(production.packages)}</strong>
        <small>{number(production.packageQty, 4)} un. por pacote</small>
      </div>
      <div>
        <span>Custo / unidade</span>
        <strong>{production.produced > 0 ? money(report.costPerUnit) : "—"}</strong>
        <small>Sobre o rendimento líquido</small>
      </div>
      <div>
        <span>Preço sugerido / pacote</span>
        <strong>{production.packages > 0 ? money(production.salePrice) : "—"}</strong>
        <small>{number(production.margin, 2)}% sobre o custo</small>
      </div>
    </div>
  </Panel>;
}
