import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Button from "../Button";
import styles from "./styles.module.scss";

export type SplitButtonOption = {
  label: ReactNode;
  description?: ReactNode;
  onSelect: () => void;
};

type Props = {
  children: ReactNode;
  onClick: () => void;
  options: SplitButtonOption[];
  menuLabel: string;
  disabled?: boolean;
};

export default function SplitButton({ children, onClick, options, menuLabel, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div ref={rootRef} className={styles["split-button"]}>
    <Button className={styles.main} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
    <Button ref={toggleRef} className={styles.toggle} disabled={disabled}
      aria-label={menuLabel} title={menuLabel} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
      onClick={() => setOpen((value) => !value)}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </Button>
    {open && <div id={menuId} role="menu" className={styles.menu}>
      {options.map((option, index) => <Button key={index} variant="text" role="menuitem" className={styles.option}
        onClick={() => { setOpen(false); option.onSelect(); }}>
        <strong>{option.label}</strong>
        {option.description && <small>{option.description}</small>}
      </Button>)}
    </div>}
  </div>;
}
