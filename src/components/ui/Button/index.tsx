import type { ComponentProps } from "react";
import { Link } from "react-router-dom";
import styles from "./styles.module.scss";

type Appearance = {
  variant?: "primary" | "secondary" | "text" | "inline";
  size?: "default" | "small";
  className?: string;
};

function buttonClass({ variant = "primary", size = "default", className }: Appearance) {
  const appearance = variant === "text" ? styles["text-button"]
    : variant === "inline" ? styles["inline-link"]
      : `${styles.button} ${variant === "primary" ? styles["button-primary"] : styles["button-secondary"]}`;
  return [
    appearance, size === "small" ? styles["button-small"] : "", className,
  ].filter(Boolean).join(" ");
}

export default function Button({ variant, size, type = "button", className, ...props }: ComponentProps<"button"> & Appearance) {
  return <button {...props} type={type} className={buttonClass({ variant, size, className })} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Appearance) {
  return <Link {...props} className={buttonClass({ variant, size, className })} />;
}
