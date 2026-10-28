import type { ComponentProps, ReactNode } from "react";
import IconButton from "../IconButton";
import { Eye } from "lucide-react";
import styles from "./styles.module.scss";

type Props = {
  name: string;
  title?: ReactNode;
  description: ReactNode;
  metrics: { label: string; value: ReactNode }[];
  viewLabel: string;
  viewTitle: string;
  onView: () => void;
};

export function SummaryList({ className, ...props }: ComponentProps<"section">) {
  return <section {...props} className={[styles["item-list"], className].filter(Boolean).join(" ")} />;
}

export default function SummaryItem({ name, title = name, description, metrics, viewLabel, viewTitle, onView }: Props) {
  return <article className={styles["item-summary"]}>
    <div className={styles["item-summary-name"]}>
      <span className={styles["recipe-thumb"]} aria-hidden="true">{name.slice(0, 1).toUpperCase() || "R"}</span>
      <div><h2>{title}</h2><span>{description}</span></div>
    </div>
    <dl className={styles["item-summary-metrics"]}>
      {metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
    </dl>
    <IconButton size="view" aria-label={viewLabel} title={viewTitle} onClick={onView}>
      <Eye size={18} aria-hidden="true" />
    </IconButton>
  </article>;
}
