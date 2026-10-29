import { useState } from "react";
import type { Ingredient, PageSize } from "../domain/models";
import type { ListControls } from "./usePagedQuery";
import { useMarketLookup } from "./useMarketLookup";
import { recipeIngredientSortColumns } from "../domain/sortColumns";

type Row = Omit<Ingredient, "id">;
type SortField = "name" | "quantity" | "unit";
const text = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Paging and ordering for the ingredients of a recipe still being registered: the rows only exist in
 * the form, so they are ordered and paged on screen. Names and units are resolved by id only while
 * ordering by them.
 */
export function useLocalIngredients(ingredients: Row[], version?: number) {
  const [paging, setPaging] = useState<{ page: number; pageSize: PageSize }>({ page: 1, pageSize: 10 });
  const [sort, setSort] = useState<{ field: SortField; descending: boolean }>();
  const byName = sort && sort.field !== "quantity";
  const lookup = useMarketLookup(byName ? ingredients.map((ingredient) => ingredient.marketItemId) : [], version);
  const totalPages = Math.max(1, Math.ceil(ingredients.length / paging.pageSize));
  const page = Math.min(paging.page, totalPages);
  const compare = (left: number, right: number) => {
    if (!sort) return 0;
    const a = ingredients[left];
    const b = ingredients[right];
    if (sort.field === "quantity") return a.quantity - b.quantity;
    const field = sort.field;
    return text.compare(lookup.items.get(a.marketItemId)?.[field] ?? "", lookup.items.get(b.marketItemId)?.[field] ?? "");
  };
  const indexes = ingredients.map((_, index) => index)
    .sort((left, right) => (sort?.descending ? compare(right, left) : compare(left, right)) || left - right)
    .slice((page - 1) * paging.pageSize, page * paging.pageSize);
  const controls: ListControls = {
    pagination: {
      page, pageSize: paging.pageSize, totalCount: ingredients.length, totalPages, busy: false,
      onPageChange: (next) => setPaging({ ...paging, page: next }),
      onPageSizeChange: (pageSize) => setPaging({ page: 1, pageSize }),
    },
    serverSort: {
      columns: recipeIngredientSortColumns, sortBy: sort?.field, descending: sort?.descending ?? false,
      onSort: (field, descending) => setSort({ field: field as SortField, descending }),
    },
    status: byName && lookup.status === "loading" ? "loading" : "ready",
  };
  return {
    ...controls,
    rows: indexes.map((index) => ingredients[index]),
    /** Original position of each visible row. */
    indexes,
    /** Shows the row just appended: original order, last page. */
    showLast: (count: number) => {
      setSort(undefined);
      setPaging({ ...paging, page: Math.max(1, Math.ceil(count / paging.pageSize)) });
    },
  };
}
