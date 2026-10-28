import type { ComponentProps } from "react";
import FormControl from "../FormControl";
import Icon from "../Icon";
import styles from "./styles.module.scss";

type Props = Omit<ComponentProps<"input">, "type" | "size" | "prefix"> & {
  "aria-label": string;
};

export default function SearchField({ className, ...props }: Props) {
  return <FormControl {...props} className={[styles.search, className].filter(Boolean).join(" ")}
    prefix={<Icon name="search" size={16} />} />;
}
