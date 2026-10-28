import type { ReactNode } from "react";
import Button from "../Button";
import styles from "./styles.module.scss";

type Props = {
  onCancel: () => void;
  submitLabel?: ReactNode;
  disabled?: boolean;
  cancelDisabled?: boolean;
  className?: string;
};

export default function FormActions({ onCancel, submitLabel = "Cadastrar", disabled = false, cancelDisabled = false, className }: Props) {
  return <div className={[styles.actions, className].filter(Boolean).join(" ")}>
    <Button variant="secondary" onClick={onCancel} disabled={cancelDisabled}>Cancelar</Button>
    <Button type="submit" disabled={disabled}>{submitLabel}</Button>
  </div>;
}
