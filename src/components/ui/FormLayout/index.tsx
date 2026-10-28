import type { ComponentProps } from "react";
import styles from "./styles.module.scss";

type Props = ComponentProps<"form"> & { disabled?: boolean };

export default function FormLayout({ disabled = false, children, className, ...props }: Props) {
  return <form {...props} className={[styles.form, className].filter(Boolean).join(" ")}>
    <fieldset className={styles.fieldset} disabled={disabled}>{children}</fieldset>
  </form>;
}

export function FormGrid({ variant = "grid", className, ...props }: ComponentProps<"div"> & {
  variant?: "grid" | "wrap";
}) {
  return <div {...props} className={[
    styles.fields, variant === "wrap" ? styles.wrap : "", className,
  ].filter(Boolean).join(" ")} />;
}
