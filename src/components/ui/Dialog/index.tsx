import { useEffect, useRef, useState, type ComponentProps } from "react";
import styles from "./styles.module.scss";

type Props = Omit<ComponentProps<"section">, "onClose" | "ref"> & {
  onClose: () => void;
  overlayClassName?: string;
  dismissDisabled?: boolean;
};

const openDialogs: symbol[] = [];

export default function Dialog({ onClose, overlayClassName, className, children, dismissDisabled = false, ...props }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [id] = useState(() => Symbol("dialog"));
  const [previousFocus] = useState(() => typeof document !== "undefined" && document.activeElement instanceof HTMLElement
    ? document.activeElement : null);

  useEffect(() => {
    openDialogs.push(id);
    return () => {
      openDialogs.splice(openDialogs.indexOf(id), 1);
    };
  }, [id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      const firstControl = dialog.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")
        ?? dialog.querySelector<HTMLElement>("button:not(:disabled), [tabindex='0']");
      (firstControl ?? dialog).focus();
    }
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [previousFocus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Only the topmost dialog reacts, so a confirmation over a modal keeps focus and Escape to itself.
      if (openDialogs.at(-1) !== id) return;
      if (event.key === "Escape") {
        if (!dismissDisabled) onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>(
        "button, input, select, textarea, a[href], [tabindex]",
      )].filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, dismissDisabled, id]);

  return <div className={[styles.overlay, overlayClassName].filter(Boolean).join(" ")}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !dismissDisabled) onClose();
    }}>
    <section tabIndex={-1} {...props} ref={dialogRef} className={[styles.dialog, className].filter(Boolean).join(" ")} role="dialog" aria-modal="true">
      {children}
    </section>
  </div>;
}
