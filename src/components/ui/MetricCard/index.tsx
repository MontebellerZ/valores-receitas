import styles from "./styles.module.scss";
import type { ComponentProps, ReactNode } from "react";

type Props = {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  negative?: boolean;
  variant?: "default" | "overview" | "compact" | "stock";
};

export default function MetricCard({
  label,
  value,
  caption,
  negative = false,
  variant = "default",
}: Props) {
  return (
    <article
      className={[
        styles["metric-card"],
        variant === "overview" ? styles["overview"] : "",
        variant === "compact" ? styles.compact : "",
        variant === "stock" ? styles.stock : "",
      ].filter(Boolean).join(" ")}
    >
      <div className={styles["metric-top"]}>{label}</div>
      <strong className={negative ? styles["sales-loss"] : undefined}>{value}</strong>
      {caption != null && <div className={styles["metric-foot"]}>{caption}</div>}
    </article>
  );
}

export function MetricGrid({ variant = "cards", className, ...props }: ComponentProps<"section"> & {
  variant?: "cards" | "results" | "simulation" | "band";
}) {
  return <section {...props} className={[
    styles.grid, variant === "cards" ? styles.cards : "",
    variant === "results" || variant === "simulation" ? styles.results : "",
    variant === "simulation" ? styles.simulation : "",
    variant === "band" ? styles.band : "", className,
  ].filter(Boolean).join(" ")} />;
}
