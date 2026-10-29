import { number } from "../../../utils/format";
import styles from "./styles.module.scss";

type Props = {
  label: string;
  total: number;
  sold: number;
  donated: number;
  lost: number;
  available: number;
};

export default function PackageDestinationBar({ label, total, sold, donated, lost, available }: Props) {
  const segments = [
    { label: "Vendidos", value: sold, className: styles.sold },
    { label: "Doados", value: donated, className: styles.donated },
    { label: "Perdidos", value: lost, className: styles.lost },
    { label: "Disponíveis", value: available, className: styles.available },
  ];
  const description = segments.map((segment) => `${segment.label}: ${number(segment.value)}`).join(", ");
  return <div>
    <div className={styles.bar} role="img" aria-label={`${label}. ${description}. Total: ${number(total)} pacotes.`}>
      {total > 0 && segments.filter((segment) => segment.value > 0).map((segment) =>
        <span key={segment.label} className={segment.className}
          style={{ width: `${segment.value / total * 100}%` }} title={`${segment.label}: ${number(segment.value)}`} />)}
    </div>
    <ul className={styles.legend}>
      {segments.map((segment) => <li key={segment.label}
        title={`${segment.label}: ${number(segment.value)} pacotes (${number(total > 0 ? segment.value / total * 100 : 0, 1)}%)`}>
        <span className={[styles.dot, segment.className].join(" ")} aria-hidden="true" />
        <span className={styles.label}>{segment.label}</span>
        <strong>{number(segment.value)}</strong>
      </li>)}
    </ul>
  </div>;
}
