import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { Page, PageSize } from "../domain/models";
import type { ListRequest, ParamValue } from "../services/query";
import type { ServerSort } from "../components/ui/DataTable";
import { getApiErrorMessage } from "../services/http";

export type QueryStatus = "loading" | "ready" | "error";

export type PagedQueryOptions<T> = {
  /** Stable fetcher, usually a `queryService` method bound to the resource. */
  fetcher: (request: ListRequest, signal: AbortSignal) => Promise<Page<T>>;
  /** Resource filters; any change returns to the first page. */
  filters?: Record<string, ParamValue>;
  defaultSort?: { sortBy: string; descending: boolean };
  defaultPageSize?: PageSize;
  /** Changes whenever saved data changes, forcing the current page to be reloaded. */
  version?: number;
  enabled?: boolean;
  errorMessage?: string;
};

export type PagedQuery<T> = {
  items: T[];
  page: number;
  pageSize: PageSize;
  totalCount: number;
  totalPages: number;
  status: QueryStatus;
  sortBy?: string;
  descending: boolean;
  setPage: (page: number) => void;
  setPageSize: (pageSize: PageSize) => void;
  setSort: (sortBy: string, descending: boolean) => void;
};

/** Props shared by every paginated table: pager, server ordering and loading state. */
export type ListControls = {
  pagination: {
    page: number; pageSize: PageSize; totalCount: number; totalPages: number; busy: boolean;
    onPageChange: (page: number) => void; onPageSizeChange: (pageSize: PageSize) => void;
  };
  serverSort: ServerSort;
  status: QueryStatus;
};

export function listControls<T>(query: PagedQuery<T>, columns: Record<number, string> = {}): ListControls {
  return {
    pagination: {
      page: query.page, pageSize: query.pageSize, totalCount: query.totalCount, totalPages: query.totalPages,
      busy: query.status === "loading", onPageChange: query.setPage, onPageSizeChange: query.setPageSize,
    },
    serverSort: { columns, sortBy: query.sortBy, descending: query.descending, onSort: query.setSort },
    status: query.status,
  };
}

type Result<T> = { key: string; page?: Page<T>; error?: true };

/** Server-side pagination state for one listing: page, page size, ordering and filters. */
export function usePagedQuery<T>({
  fetcher, filters = {}, defaultSort, defaultPageSize = 10, version = 0, enabled = true,
  errorMessage = "Não foi possível carregar a listagem.",
}: PagedQueryOptions<T>): PagedQuery<T> {
  const [sort, setSortState] = useState(defaultSort);
  const [pageSize, setPageSizeState] = useState<PageSize>(defaultPageSize);
  const filterKey = JSON.stringify([filters, sort, pageSize]);
  const [pageState, setPageState] = useState({ filterKey, page: 1 });
  const page = pageState.filterKey === filterKey ? pageState.page : 1;
  const request: ListRequest = { ...filters, page, pageSize, sortBy: sort?.sortBy, descending: sort?.descending };
  const key = JSON.stringify([request, version, filterKey]);
  const [result, setResult] = useState<Result<T>>();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const [current, , currentFilterKey] = JSON.parse(key) as [ListRequest, number, string];
    fetcher(current, controller.signal).then((loaded) => {
      if (controller.signal.aborted) return;
      // A deletion can leave the requested page past the end; jump to the new last page.
      if (loaded.totalPages > 0 && current.page > loaded.totalPages && loaded.items.length === 0)
        setPageState({ filterKey: currentFilterKey, page: loaded.totalPages });
      setResult({ key, page: loaded });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setResult({ key, error: true });
      toast.error(getApiErrorMessage(error, errorMessage), { toastId: `query-${errorMessage}` });
    });
    return () => controller.abort();
  }, [key, enabled, fetcher, errorMessage]);

  const loaded = result?.page;
  const status: QueryStatus = !enabled ? "loading" : result?.key !== key ? "loading" : result.error ? "error" : "ready";
  return {
    items: status === "error" ? [] : loaded?.items ?? [],
    page,
    pageSize,
    totalCount: loaded?.totalCount ?? 0,
    totalPages: loaded?.totalPages ?? 0,
    status,
    sortBy: sort?.sortBy,
    descending: sort?.descending ?? false,
    setPage: (next) => setPageState({ filterKey, page: Math.max(1, Math.floor(next)) }),
    setPageSize: (next) => setPageSizeState(next),
    setSort: (sortBy, descending) => setSortState({ sortBy, descending }),
  };

}
