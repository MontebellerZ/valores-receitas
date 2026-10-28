import styles from "./styles.module.scss";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  eyebrow?: ReactNode;
  eyebrowDot?: boolean;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  variant?: "default" | "welcome";
};

export default function PageHeader({
  title,
  eyebrow,
  eyebrowDot = false,
  description,
  action,
  className = "",
  variant = "default",
}: Props) {
  return (
    <section
      className={[
        styles["welcome-row"],
        variant === "default" ? styles["page-title-row"] : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div>
        {eyebrow && <div className={styles["eyebrow"]}>
          {eyebrowDot && <span className={styles.dot} aria-hidden="true" />}
          {eyebrow}
        </div>}
        <h1 className={styles["title"]}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </section>
  );
}
