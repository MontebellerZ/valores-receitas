import styles from "./styles.module.scss";
export default function PaymentBadge({ paid, donated = false }: { paid: boolean; donated?: boolean }) {
  return (
    <span className={[styles["sales-payment"], donated ? styles["is-donated"] : paid ? styles["is-paid"] : ""].filter(Boolean).join(" ")}>
      {donated ? "Doado" : paid ? "Recebido" : "A receber"}
    </span>
  );
}
