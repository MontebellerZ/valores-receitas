import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { PageSize, ProductionReportPage } from "../domain/models";
import { queryService } from "../services/query";
import { getApiErrorMessage } from "../services/http";
import type { ListControls, QueryStatus } from "./usePagedQuery";

type Result = { key: string; report?: ProductionReportPage; error?: true };

/** Server totals of one production plus one page of its daily report (the chart is paginated too). */
export function useProductionReport(id: string | undefined, version = 0) {
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [pageState, setPageState] = useState({ scope: "", page: 1 });
  const scope = JSON.stringify([id ?? null, pageSize]);
  const page = pageState.scope === scope ? pageState.page : 1;
  const key = JSON.stringify([id ?? null, page, pageSize, version]);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    const [currentId, currentPage, currentPageSize] = JSON.parse(key) as [string | null, number, PageSize];
    if (!currentId) return;
    const controller = new AbortController();
    queryService.report(currentId, { page: currentPage, pageSize: currentPageSize }, controller.signal).then((report) => {
      if (controller.signal.aborted) return;
      setResult({ key, report });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setResult({ key, error: true });
      toast.error(getApiErrorMessage(error, "Não foi possível carregar o relatório da produção."), { toastId: "production-report" });
    });
    return () => controller.abort();
  }, [key]);

  const current = result?.key === key ? result : undefined;
  // Keep the previous totals of the same production visible while another page or version loads.
  const sameProduction = result && (JSON.parse(result.key) as [string | null])[0] === (id ?? null);
  const report = current?.report ?? (sameProduction ? result?.report : undefined);
  const status: QueryStatus = !current ? "loading" : current.error ? "error" : "ready";
  const pagination: ListControls["pagination"] = {
    page, pageSize, totalCount: report?.daily.totalCount ?? 0, totalPages: report?.daily.totalPages ?? 0,
    busy: status === "loading",
    onPageChange: (next) => setPageState({ scope, page: Math.max(1, Math.floor(next)) }),
    onPageSizeChange: setPageSize,
  };
  return { report, status, pagination };
}
