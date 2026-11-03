import { CircleAlert } from "lucide-react";
import Button from "../../Button";
import styles from "./styles.module.scss";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

type Props = {
  title: string;
  description?: string;
  action?: ToastAction;
};

export default function ToastMessage({ title, description, action }: Props) {
  return (
    <div className={styles.message}>
      <CircleAlert className={styles.icon} size={21} aria-hidden="true" />
      <div className={styles.content}>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
        {action && (
          <Button
            className={styles.action}
            variant="secondary"
            size="small"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
