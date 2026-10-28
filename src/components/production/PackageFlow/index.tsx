import type { CalculatedProduction } from "../../../domain/models";
import type { ProductionReport } from "../../../domain/productionReport";
import { number } from "../../../utils/format";
import FormControl from "../../ui/FormControl";
import FormField from "../../ui/FormField";
import Panel from "../../ui/Panel";
import styles from "./styles.module.scss";

export default function PackageFlow({ production, report, disabled = false, onLostChange }: {
  production: CalculatedProduction;
  report: ProductionReport;
  disabled?: boolean;
  onLostChange: (lostPackages: number) => void;
}) {
  const total = production.packages;
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  const segments = [
    { key: "sold", label: "Vendidos", value: report.soldPackages, className: styles.sold },
    { key: "donated", label: "Doados", value: report.donatedPackages, className: styles.donated },
    { key: "lost", label: "Perdidos", value: report.lostPackages, className: styles.lost },
    { key: "available", label: "Disponíveis", value: report.availablePackages, className: styles.available },
  ];
  const description = segments.map((segment) => `${segment.label}: ${number(segment.value)}`).join(", ");

  return <Panel title="Destino dos pacotes"
    description={total > 0 ? `${number(total)} pacote(s) formados nesta produção` : "Nenhum pacote completo foi formado"}>
    <div className={styles.bar} role="img" aria-label={`Destino dos pacotes. ${description}`}>
      {segments.filter((segment) => segment.value > 0).map((segment) => (
        <span key={segment.key} className={segment.className} style={{ width: `${share(segment.value)}%` }} />
      ))}
    </div>
    <ul className={styles.legend}>
      {segments.map((segment) => <li key={segment.key}>
        <span className={[styles.dot, segment.className].join(" ")} aria-hidden="true" />
        <span className={styles.label}>{segment.label}</span>
        <strong>{number(segment.value)}</strong>
        <small>{number(share(segment.value), 1)}%</small>
      </li>)}
    </ul>
    <div className={styles["lost-field"]}>
      <FormField label="Pacotes perdidos">
        <FormControl disabled={disabled} type="number" min="0" step="1" max={report.lostPackages + report.availablePackages}
          value={production.lostPackages ?? 0}
          onChange={(event) => onLostChange(event.target.value === "" ? 0 : Number(event.target.value))} />
      </FormField>
      <p>Pacotes prontos que venceram, foram roubados ou descartados. Eles deixam de ficar disponíveis para venda.</p>
    </div>
  </Panel>;
}
