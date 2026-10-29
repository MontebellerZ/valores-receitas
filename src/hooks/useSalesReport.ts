import { useState } from "react";
import type { PageSize } from "../domain/models";
import type { DateRange, ListRequest } from "../services/query";
import { queryService } from "../services/query";
import { useResource } from "./useResource";
import type { ListControls } from "./usePagedQuery";

const fetchReport = (key: string, signal: AbortSignal) =>
  queryService.salesReport(JSON.parse(key) as ListRequest, signal);

export function useSalesReport(filters: DateRange & { productionId?: string }, version: number) {
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [pageState, setPageState] = useState({ scope: "", page: 1 });
  const scope = JSON.stringify([filters, pageSize]);
  const page = pageState.scope === scope ? pageState.page : 1;
  const resource = useResource(fetchReport, JSON.stringify({ ...filters, page, pageSize }), version,
    "Não foi possível carregar os indicadores de vendas.");
  const lastPage = resource.data ? Math.max(1, resource.data.daily.totalPages) : undefined;
  if (lastPage !== undefined && page > lastPage) setPageState({ scope, page: lastPage });
  const pagination: ListControls["pagination"] = {
    page, pageSize, totalCount: resource.data?.daily.totalCount ?? 0, totalPages: resource.data?.daily.totalPages ?? 0,
    busy: resource.status === "loading",
    onPageChange: (next) => setPageState({ scope, page: Math.max(1, Math.floor(next)) }),
    onPageSizeChange: setPageSize,
  };
  return { data: resource.data, status: resource.status, pagination };
}
