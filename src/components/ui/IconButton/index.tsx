import type { ComponentProps } from "react";
import styles from "./styles.module.scss";

type Props = ComponentProps<"button"> & {
  "aria-label": string;
  size?: "default" | "small" | "view";
  danger?: boolean;
};

export default function IconButton({ size = "default", danger = false, type = "button", className, ...props }: Props) {
  return <button {...props} type={type} className={[
    size === "small" ? styles["mini-icon-button"] : styles["icon-button"],
    size === "view" ? styles["view-item"] : "",
    danger ? styles["delete-item"] : "", className,
  ].filter(Boolean).join(" ")} />;
}
