import { useState } from "react";
import type { ProductionDiscard } from "../../../domain/models";
import { MAX_DISCARD_REASON_LENGTH } from "../../../domain/workspaceRules";
import { localToday } from "../../../utils/format";
import FormActions from "../../ui/FormActions";
import FormControl from "../../ui/FormControl";
import FormField from "../../ui/FormField";
import FormLayout, { FormGrid } from "../../ui/FormLayout";
import RegistrationModal from "../../ui/RegistrationModal";
import styles from "./styles.module.scss";

type Props = {
  /** Production date (yyyy-MM-dd); the discard cannot happen before it. */
  productionDate: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (discard: ProductionDiscard) => void;
};

/** Collects the date and reason of a total production discard. The caller validates and saves it. */
export default function DiscardProductionModal({ productionDate, busy = false, onClose, onSubmit }: Props) {
  const [discard, setDiscard] = useState<ProductionDiscard>(() => {
    const today = localToday();
    return { date: productionDate > today ? productionDate : today, reason: "" };
  });

  return <RegistrationModal title="Descartar produção" busy={busy} onClose={onClose}>
    <FormLayout disabled={busy} onSubmit={(event) => {
      event.preventDefault();
      onSubmit(discard);
    }}>
      <p className={styles.note}>
        Use quando toda a produção foi perdida antes de qualquer venda. O custo e o consumo de estoque são mantidos,
        mas nenhum pacote fica disponível para venda. Para perdas parciais, informe os pacotes perdidos.
      </p>
      <FormGrid>
        <FormField label="Data do descarte">
          <FormControl autoFocus type="date" required min={productionDate} value={discard.date}
            onChange={(event) => setDiscard({ ...discard, date: event.target.value })} />
        </FormField>
        <FormField label="Motivo do descarte" className={styles.reason}>
          <FormControl as="textarea" required maxLength={MAX_DISCARD_REASON_LENGTH} rows={4} value={discard.reason}
            placeholder="Ex.: massa desandou, lote contaminado, produto vencido"
            onChange={(event) => setDiscard({ ...discard, reason: event.target.value })} />
        </FormField>
      </FormGrid>
      <FormActions onCancel={onClose} disabled={busy} cancelDisabled={busy}
        submitLabel={busy ? "Salvando..." : "Descartar produção"} />
    </FormLayout>
  </RegistrationModal>;
}
