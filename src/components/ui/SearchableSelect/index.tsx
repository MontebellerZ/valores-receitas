import FormControl from "../FormControl";
import styles from "./styles.module.scss";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { normalize } from "../../../utils/parsing";
import Icon from "../Icon";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type Props<T extends string> = {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  controlSize?: "compact" | "default" | "large";
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: ComponentProps<"input">["aria-invalid"];
  /** Label of the current value when it is not among the loaded options (remote lists). */
  selectedLabel?: string;
  /** Server-side search: options are rendered as received and more pages load on demand. */
  remote?: RemoteOptions;
};

export type RemoteOptions = {
  onQueryChange: (query: string) => void;
  onOpenChange?: (open: boolean) => void;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  error?: boolean;
};

export default function SearchableSelect<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Selecione...",
  emptyMessage = "Nenhum item encontrado.",
  controlSize = "default",
  className,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  selectedLabel,
  remote,
}: Props<T>) {
  const selectId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [popupPosition, setPopupPosition] = useState({
    top: 0,
    left: 0,
    width: 190,
    maxHeight: 220,
  });
  const selected = options.find((item) => item.value === value)
    ?? (value && selectedLabel !== undefined ? { value, label: selectedLabel } : undefined);
  const expanded = open && !disabled;
  const changeQuery = (next: string) => {
    setQuery(next);
    remote?.onQueryChange(next);
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    remote?.onOpenChange?.(next);
  };
  const filtered = useMemo(() => {
    if (remote) return options;
    const normalizedQuery = normalize(query);
    return options.filter((item) =>
      normalize(item.label).includes(normalizedQuery),
    );
  }, [options, query, remote]);
  const activeOptionIndex = filtered[activeIndex] && !filtered[activeIndex].disabled
    ? activeIndex
    : filtered.findIndex((item) => !item.disabled);

  const missingValue = required && (!selected || selected.value === "");
  useLayoutEffect(() => {
    inputRef.current?.setCustomValidity(missingValue ? "Selecione uma opção." : "");
  }, [missingValue]);
  const closeFromOutside = useEffectEvent(() => changeOpen(false));

  useEffect(() => {
    if (expanded)
      optionsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [expanded, activeOptionIndex, query]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !optionsRef.current?.contains(target)
      )
        closeFromOutside();
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!expanded || !rootRef.current) return;
    const updatePopupPosition = () => {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const margin = 12;
      const gap = 5;
      const width = Math.min(
        Math.max(bounds.width, 190),
        window.innerWidth - margin * 2,
      );
      const left = Math.max(
        margin,
        Math.min(bounds.left, window.innerWidth - width - margin),
      );
      const roomBelow = window.innerHeight - bounds.bottom - gap - margin;
      const roomAbove = bounds.top - gap - margin;
      const showAbove = roomBelow < 150 && roomAbove > roomBelow;
      const maxHeight = Math.max(
        90,
        Math.min(220, showAbove ? roomAbove : roomBelow),
      );
      setPopupPosition({
        top: showAbove ? bounds.top - gap - maxHeight : bounds.bottom + gap,
        left,
        width,
        maxHeight,
      });
    };
    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [expanded]);

  const choose = (option: SelectOption<T>) => {
    if (disabled || inputRef.current?.matches(":disabled") || option.disabled) return;
    onChange(option.value);
    changeQuery("");
    changeOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      let index = expanded ? activeOptionIndex + direction : direction === 1 ? 0 : filtered.length - 1;
      while (index >= 0 && index < filtered.length && filtered[index].disabled) index += direction;
      if (index >= 0 && index < filtered.length) setActiveIndex(index);
      changeOpen(true);
    } else if (event.key === "Enter" && expanded) {
      event.preventDefault();
      if (filtered[activeOptionIndex]) choose(filtered[activeOptionIndex]);
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      changeQuery("");
      changeOpen(false);
    }
  };

  return (
    <span className={[styles["market-select"], className].filter(Boolean).join(" ")} ref={rootRef}>
      <FormControl
        id={id}
        ref={inputRef}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={required}
        aria-autocomplete="list"
        aria-activedescendant={
          expanded && filtered[activeOptionIndex]
            ? `${selectId}-option-${activeOptionIndex}`
            : undefined
        }
        aria-controls={`${selectId}-options`}
        aria-expanded={expanded}
        aria-haspopup="listbox"
        autoComplete="off"
        role="combobox"
        placeholder={expanded ? "Pesquisar..." : placeholder}
        value={expanded ? query : (selected?.label ?? "")}
        disabled={disabled}
        onFocus={() => {
          changeQuery("");
          changeOpen(true);
          setActiveIndex(0);
        }}
        onBlur={() => {
          changeOpen(false);
          changeQuery("");
        }}
        onClick={() => {
          if (!open) {
            changeQuery("");
            changeOpen(true);
            setActiveIndex(0);
          }
        }}
        onChange={(event) => {
          changeQuery(event.target.value);
          setActiveIndex(0);
          if (!open) changeOpen(true);
        }}
        onKeyDown={handleKeyDown}
        controlSize={controlSize}
        prefix={<Icon name="search" size={15} />}
        suffix={<span className={styles["market-select-caret"]} aria-hidden="true" />}
      />
      {expanded &&
        createPortal(
          <div
            className={styles["market-select-options"]}
            id={`${selectId}-options`}
            ref={optionsRef}
            role="listbox"
            aria-label={ariaLabel ? `Opções: ${ariaLabel}` : "Opções"}
            style={{
              top: popupPosition.top,
              left: popupPosition.left,
              width: popupPosition.width,
              maxHeight: popupPosition.maxHeight,
            }}
          >
            {filtered.length ? (
              filtered.map((item, index) => (
                <button
                  className={[styles["market-select-option"], item.value === value ? styles["selected"] : "", index === activeOptionIndex ? styles["active"] : ""].filter(Boolean).join(" ")}
                  id={`${selectId}-option-${index}`}
                  key={item.value}
                  role="option"
                  aria-selected={item.value === value}
                  aria-disabled={item.disabled}
                  disabled={item.disabled}
                  tabIndex={-1}
                  data-active={index === activeOptionIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                  type="button"
                >
                  <span>{item.label}</span>
                  {item.value === value && <Icon name="check" size={15} />}
                </button>
              ))
            ) : (
              <div className={styles["market-select-empty"]}>
                {remote?.loading ? "Carregando..." : remote?.error ? "Não foi possível carregar as opções." : emptyMessage}
              </div>
            )}
            {remote?.hasMore && filtered.length > 0 && (
              <button
                className={styles["market-select-more"]}
                type="button"
                tabIndex={-1}
                disabled={remote.loading}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => remote.onLoadMore?.()}
              >
                {remote.loading ? "Carregando..." : "Carregar mais"}
              </button>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
