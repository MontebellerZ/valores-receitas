import Button from "../Button";
import Icon from "../Icon";
import styles from "./styles.module.scss";

type Props = {
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

export default function UnsavedChangesBar({ busy, onSave, onDiscard }: Props) {
  return (
    <div className={styles["unsaved-bar"]} role="status">
      <span>Você tem alterações não salvas nesta tela.</span>
      <div className={styles["unsaved-actions"]}>
        <Button variant="secondary" disabled={busy} onClick={onDiscard}>Descartar</Button>
        <Button disabled={busy} onClick={onSave}>
          <Icon name="check" size={16} /> {busy ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
