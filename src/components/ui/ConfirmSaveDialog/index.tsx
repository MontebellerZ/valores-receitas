import Button from "../Button";
import Dialog from "../Dialog";
import Icon from "../Icon";
import styles from "./styles.module.scss";

type Props = {
  message: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmSaveDialog({ message, onCancel, onConfirm }: Props) {
  if (!message) return null;
  return (
    <Dialog
      onClose={onCancel}
      overlayClassName={styles["confirm-overlay"]}
      className={styles["confirm-dialog"]}
      aria-labelledby="confirm-save-title"
      aria-describedby="confirm-save-description"
    >
      <h2 id="confirm-save-title">Confirmar salvamento?</h2>
      <p id="confirm-save-description">{message}</p>
      <div className={styles["confirm-actions"]}>
        <Button variant="secondary" autoFocus onClick={onCancel}>Cancelar</Button>
        <Button onClick={onConfirm}><Icon name="check" size={16} /> Salvar</Button>
      </div>
    </Dialog>
  );
}
