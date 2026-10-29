import { useEffect, useState } from "react";
import type { Page, PageSize } from "../domain/models";
import type { ListRequest, ParamValue } from "../services/query";
import type { RemoteOptions } from "../components/ui/SearchableSelect";
import { useDebouncedValue } from "./useDebouncedValue";

type Options<T> = {
  fetcher: (request: ListRequest, signal: AbortSignal) => Promise<Page<T>>;
  filters?: Record<string, ParamValue>;
  sortBy?: string;
  descending?: boolean;
  version?: number;
  pageSize?: PageSize;
};

type Loaded<T> = { baseKey: string; items: T[]; loadedPages: number; totalPages: number; error?: boolean };

/**
 * Options for a searchable select backed by a paged endpoint: loads only while the list is open,
 * searches on the server and appends one page at a time through "Carregar mais".
 */
export function useRemoteOptions<T>({ fetcher, filters = {}, sortBy, descending, version = 0, pageSize = 25 }: Options<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const search = useDebouncedValue(query.trim());
  const baseKey = JSON.stringify([filters, search, sortBy, descending, version, pageSize]);
  const [requested, setRequested] = useState({ baseKey, count: 1 });
  const count = requested.baseKey === baseKey ? requested.count : 1;
  const [loaded, setLoaded] = useState<Loaded<T>>();
  const current = loaded?.baseKey === baseKey ? loaded : undefined;
  const needsFetch = open && !(current && (current.loadedPages >= count || current.error));
  const fetchKey = needsFetch ? JSON.stringify([baseKey, count]) : "";

  useEffect(() => {
    if (!fetchKey) return;
    const controller = new AbortController();
    const [key, page] = JSON.parse(fetchKey) as [string, number];
    const [currentFilters, currentSearch, currentSortBy, currentDescending, , currentPageSize] =
      JSON.parse(key) as [Record<string, ParamValue>, string, string | undefined, boolean | undefined, number, PageSize];
    fetcher({ ...currentFilters, search: currentSearch, sortBy: currentSortBy, descending: currentDescending,
      page, pageSize: currentPageSize }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoaded((previous) => ({
        baseKey: key,
        items: page > 1 && previous?.baseKey === key ? [...previous.items, ...result.items] : result.items,
        loadedPages: page,
        totalPages: result.totalPages,
      }));
    }).catch(() => {
      if (controller.signal.aborted) return;
      setLoaded((previous) => ({ baseKey: key, items: previous?.baseKey === key ? previous.items : [],
        loadedPages: previous?.baseKey === key ? previous.loadedPages : 0, totalPages: 0, error: true }));
    });
    return () => controller.abort();
  }, [fetchKey, fetcher]);

  const remote: RemoteOptions = {
    onQueryChange: setQuery,
    onOpenChange: (next) => {
      setOpen(next);
      // Reopening after a failure retries the request.
      if (next && current?.error) setLoaded(undefined);
    },
    loading: needsFetch,
    error: Boolean(current?.error),
    hasMore: Boolean(current && current.loadedPages < current.totalPages),
    onLoadMore: () => setRequested({ baseKey, count: (current?.loadedPages ?? 0) + 1 }),
  };
  return { items: current?.items ?? [], remote };
}
