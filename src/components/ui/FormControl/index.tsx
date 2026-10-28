import type { ComponentProps, ReactNode } from "react";
import styles from "./styles.module.scss";

type PresentationProps = {
  prefix?: ReactNode;
  suffix?: ReactNode;
  controlSize?: "compact" | "default" | "large";
  className?: string;
};

type Props = PresentationProps & (
  | ({ as?: "input"; } & Omit<ComponentProps<"input">, keyof PresentationProps>)
  | ({ as: "select"; } & Omit<ComponentProps<"select">, keyof PresentationProps>)
  | ({ as: "textarea"; } & Omit<ComponentProps<"textarea">, keyof PresentationProps>)
);

export default function FormControl({
  prefix,
  suffix,
  controlSize = "default",
  className,
  ...props
}: Props) {
  let control: ReactNode;
  if (props.as === "select") {
    const { as: Element, ...nativeProps } = props;
    control = <Element {...nativeProps} className={styles.control} />;
  } else if (props.as === "textarea") {
    const { as: Element, ...nativeProps } = props;
    control = <Element {...nativeProps} className={styles.control} />;
  } else {
    const { as: Element = "input", ...nativeProps } = props;
    control = <Element {...nativeProps} className={styles.control} />;
  }

  return (
    <span
      className={[
        styles.frame,
        controlSize === "compact" ? styles.compact : "",
        controlSize === "large" ? styles.large : "",
        props.as === "textarea" ? styles.multiline : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {prefix != null && <span className={styles.adornment}>{prefix}</span>}
      {control}
      {suffix != null && <span className={styles.suffix}>{suffix}</span>}
    </span>
  );
}
