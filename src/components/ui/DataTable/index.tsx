import { Children, cloneElement, isValidElement, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Button from "../Button";
import { compareSortValues, type SortDirection, type SortValue } from "../../../utils/sorting";
import styles from "./styles.module.scss";

type Props = ComponentProps<"table"> & {
  variant?: "default" | "sales" | "compact";
  containerClassName?: string;
  defaultSort?: { column: number; direction: SortDirection };
};

type TableNodeProps = {
  children?: ReactNode;
  "data-sort-value"?: SortValue;
};

function cells(row: ReactNode) {
  return isValidElement<TableNodeProps>(row) ? Children.toArray(row.props.children) : [];
}

function sortValue(row: ReactNode, column: number): SortValue {
  const cell = cells(row)[column];
  return isValidElement<TableNodeProps>(cell) ? cell.props["data-sort-value"] : undefined;
}

export default function DataTable({ variant = "default", containerClassName, className, children, defaultSort, ...props }: Props) {
  const [sort, setSort] = useState(defaultSort);
  const sections = Children.toArray(children);
  const body = sections.find((section) => isValidElement(section) && section.type === "tbody");
  const rows = cells(body);
  const sortable = new Set(rows.flatMap((row) => cells(row).flatMap((cell, column) =>
    isValidElement<TableNodeProps>(cell) && Object.hasOwn(cell.props, "data-sort-value") ? [column] : [])));
  const content = sections.map((section) => {
    if (!isValidElement<TableNodeProps>(section)) return section;
    if (section.type === "tbody" && sort && sortable.has(sort.column)) {
      return cloneElement(section, {}, [...cells(section)].sort((left, right) =>
        compareSortValues(sortValue(left, sort.column), sortValue(right, sort.column), sort.direction)));
    }
    if (section.type !== "thead") return section;
    return cloneElement(section, {}, Children.map(section.props.children, (row) => {
      if (!isValidElement<TableNodeProps>(row)) return row;
      return cloneElement(row, {}, Children.map(row.props.children, (cell, column) => {
        if (!isValidElement<ComponentProps<"th">>(cell) || cell.type !== "th" || !sortable.has(column)) return cell;
        const direction = sort?.column === column ? sort.direction : undefined;
        const nextDirection = direction === "ascending" ? "descending" : "ascending";
        const Indicator = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowUpDown;
        return cloneElement(cell, { scope: "col", "aria-sort": direction ?? "none" },
          <Button variant="text" className={styles["sort-button"]}
            title={`Ordenar em ordem ${nextDirection === "ascending" ? "crescente" : "decrescente"}`}
            onClick={() => setSort({ column, direction: nextDirection })}>
            {cell.props.children}<Indicator size={13} aria-hidden="true" />
          </Button>);
      }));
    }));
  });
  return <div className={[styles["table-scroll"], containerClassName].filter(Boolean).join(" ")}>
    <table {...props} className={[
      styles["data-table"], variant === "sales" ? styles["sales-table"] : "",
      variant === "compact" ? styles.compact : "", className,
    ].filter(Boolean).join(" ")}>{content}</table>
  </div>;
}
