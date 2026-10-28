import { useId, type ComponentProps, type ReactNode } from "react";
import styles from "./styles.module.scss";

type Props = Omit<ComponentProps<"section">, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "card" | "plain" | "inset";
};

export default function Panel({ title, description, action, variant = "card", children, className, ...props }: Props) {
  const titleId = useId();
  return <section aria-labelledby={title ? titleId : undefined} {...props} className={[
    styles.panel, variant === "card" ? styles.card : "",
    variant === "plain" ? styles.plain : "", variant === "inset" ? styles.inset : "", className,
  ].filter(Boolean).join(" ")}>
    {title && <header className={styles.heading}>
      <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </header>}
    {children}
  </section>;
}
