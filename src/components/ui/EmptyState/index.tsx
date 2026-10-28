import type { ComponentProps, ReactNode } from "react";
import styles from "./styles.module.scss";

type Props = Omit<ComponentProps<"div">, "title"> & {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "inline" | "editor";
};

export default function EmptyState({ title, icon, action, variant = "inline", children, className, ...props }: Props) {
  return <div {...props} className={[
    variant === "editor" ? `${styles.panel} ${styles["empty-editor"]}` : styles["empty-inline"],
    className,
  ].filter(Boolean).join(" ")}>
    {icon && (variant === "editor" ? <span className={styles["empty-illustration"]}>{icon}</span> : icon)}
    {title && <h2>{title}</h2>}
    {children}
    {action}
  </div>;
}
