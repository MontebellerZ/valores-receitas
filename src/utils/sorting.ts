export type SortValue = string | number | null | undefined;
export type SortDirection = "ascending" | "descending";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function compareSortValues(left: SortValue, right: SortValue, direction: SortDirection): number {
  if (left == null || right == null) {
    if (left == null && right == null) return 0;
    return left == null ? 1 : -1;
  }
  const result = typeof left === "number" && typeof right === "number"
    ? left - right
    : collator.compare(String(left), String(right));
  return direction === "ascending" ? result : -result;
}
