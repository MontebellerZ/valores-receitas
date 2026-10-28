import Button from "../Button";
import Dialog from "../Dialog";
import styles from "./styles.module.scss";

type Props = {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
};

export default function ConfirmDiscardDialog({ open, onStay, onDiscard }: Props) {
  if (!open) return null;
  return (
    <Dialog
      onClose={onStay}
      overlayClassName={styles["confirm-overlay"]}
      className={styles["confirm-dialog"]}
      aria-labelledby="confirm-discard-title"
      aria-describedby="confirm-discard-description"
    >
      <h2 id="confirm-discard-title">Sair sem salvar?</h2>
      <p id="confirm-discard-description">
        Você tem alterações não salvas nesta tela. Se sair agora, elas serão descartadas.
      </p>
      <div className={styles["confirm-actions"]}>
        <Button variant="secondary" autoFocus onClick={onStay}>Continuar editando</Button>
        <Button className={styles["confirm-delete-button"]} onClick={onDiscard}>Descartar e sair</Button>
      </div>
    </Dialog>
  );
}
