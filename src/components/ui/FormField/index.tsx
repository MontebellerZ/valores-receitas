import type { ComponentProps, ReactNode } from "react";
import styles from "./styles.module.scss";

type Props = ComponentProps<"label"> & {
  label: ReactNode;
  variant?: "default" | "registration" | "inline";
};

export default function FormField({ label, variant = "default", className, children, ...props }: Props) {
  return <label {...props} className={[
    styles.field, variant === "registration" ? styles.registration : "",
    variant === "inline" ? styles.inline : "", className,
  ].filter(Boolean).join(" ")}>
    <span>{label}</span>
    {children}
  </label>;
}
