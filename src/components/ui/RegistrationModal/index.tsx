import type { ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./styles.module.scss";
import Dialog from "../Dialog";
import IconButton from "../IconButton";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  className?: string;
};

export default function RegistrationModal({ title, onClose, children, busy = false, className }: Props) {
  return (
    <Dialog
        onClose={onClose}
        dismissDisabled={busy}
        aria-busy={busy}
        overlayClassName={styles["modal-overlay"]}
        className={[styles["modal-dialog"], className].filter(Boolean).join(" ")}
        aria-label={title}
      >
        <header className={styles["modal-header"]}>
          <h2>{title}</h2>
          <IconButton
            type="button"
            className={styles["modal-close"]}
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </IconButton>
        </header>
        {children}
    </Dialog>
  );
}
