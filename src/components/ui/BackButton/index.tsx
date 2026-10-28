import type { ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";
import Button from "../Button";
import styles from "./styles.module.scss";

export default function BackButton({ className, children, ...props }: ComponentProps<"button">) {
  return <Button {...props} variant="text" className={[styles.back, className].filter(Boolean).join(" ")}>
    <ArrowLeft size={17} aria-hidden="true" /> {children}
  </Button>;
}
