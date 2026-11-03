import type { ComponentProps } from "react";
import styles from "./styles.module.scss";

type Props = ComponentProps<"div">;

export default function LoadingState({ className, ...props }: Props) {
  return <div {...props} role="status" className={[styles.loading, className].filter(Boolean).join(" ")} />;
}
