import type { ComponentProps } from "react";
import type { Page, PageSize } from "../../../domain/models";
import type { ListRequest, ParamValue } from "../../../services/query";
import { useRemoteOptions } from "../../../hooks/useRemoteOptions";
import SearchableSelect, { type SelectOption } from "../SearchableSelect";
import styles from "./styles.module.scss";

type SelectProps = Omit<ComponentProps<typeof SearchableSelect<string>>, "options" | "remote" | "onChange">;

type Props<T> = SelectProps & {
  fetcher: (request: ListRequest, signal: AbortSignal) => Promise<Page<T>>;
  toOption: (item: T) => SelectOption;
  onChange: (value: string, item: T | undefined) => void;
  filters?: Record<string, ParamValue>;
  sortBy?: string;
  descending?: boolean;
  version?: number;
  pageSize?: PageSize;
  /** Values that cannot be picked (for example, ingredients already in the recipe). */
  disabledValues?: string[];
  /** Leading options that do not come from the server, such as "Todas". */
  staticOptions?: SelectOption[];
};

/** Searchable select whose options are searched and paged on the server. */
export default function RemoteSelect<T>({
  fetcher, toOption, onChange, filters, sortBy, descending, version, pageSize, disabledValues = [], staticOptions = [],
  className, ...props
}: Props<T>) {
  const { items, remote } = useRemoteOptions({ fetcher, filters, sortBy, descending, version, pageSize });
  const loaded = items.map((item) => ({ item, option: toOption(item) }));
  const options = [
    ...staticOptions,
    ...loaded.map(({ option }) => disabledValues.includes(option.value) && option.value !== props.value
      ? { ...option, disabled: true } : option),
  ];
  return <SearchableSelect {...props} className={[styles.remote, className].filter(Boolean).join(" ")}
    options={options} remote={remote}
    onChange={(value) => onChange(value, loaded.find(({ option }) => option.value === value)?.item)} />;
}
