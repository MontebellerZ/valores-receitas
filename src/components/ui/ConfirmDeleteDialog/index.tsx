import Button from "../Button";
import styles from "./styles.module.scss";
import Dialog from "../Dialog";
import type { PendingDelete } from "../../../types/navigation";
import Icon from "../Icon";

type Props = {
  pendingDelete: PendingDelete | { kind: "stock"; id: string; label: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
};

export default function ConfirmDeleteDialog({
  pendingDelete,
  onCancel,
  onConfirm,
  busy = false,
}: Props) {
  if (!pendingDelete) return null;
  return (
    <Dialog
        onClose={onCancel}
        dismissDisabled={busy}
        aria-busy={busy}
        overlayClassName={styles["confirm-overlay"]}
        className={styles["confirm-dialog"]}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <div className={styles["confirm-icon"]}>
          <Icon name="trash" size={21} />
        </div>
        <h2 id="confirm-title">Confirmar exclusão?</h2>
        <p id="confirm-description">
          {pendingDelete.kind === "stock"
            ? `O pacote “${pendingDelete.label}” será excluído permanentemente. Somente pacotes sem consumo, baixa ou correção podem ser excluídos. Os demais pacotes da compra não serão alterados.`
            : pendingDelete.kind === "recipe"
            ? `A receita “${pendingDelete.label}” será excluída permanentemente.`
            : pendingDelete.kind === "production"
              ? `O registro de produção “${pendingDelete.label}” será removido do histórico.`
              : pendingDelete.kind === "sale"
                ? `A venda “${pendingDelete.label}” será excluída. Os pacotes voltarão ao saldo disponível e os totais de vendas serão recalculados.`
                : pendingDelete.kind === "market"
                  ? `O item “${pendingDelete.label}” será excluído${pendingDelete.ingredientCount ? ` e removido de ${pendingDelete.ingredientCount} ${pendingDelete.ingredientCount === 1 ? "receita" : "receitas"}` : ""}. Esta ação não pode ser desfeita.`
                  : `O ingrediente “${pendingDelete.label}” será removido desta receita.`}
        </p>
        <div className={styles["confirm-actions"]}>
          <Button
            variant="secondary"
            autoFocus
            disabled={busy}
            onClick={() => onCancel()}
          >
            Cancelar
          </Button>
          <Button className={styles["confirm-delete-button"]} disabled={busy} onClick={onConfirm}>
            <Icon name="trash" size={16} /> {busy ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
    </Dialog>
  );
}
