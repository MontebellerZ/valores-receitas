import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OverviewPage from "../../../pages/overview/OverviewPage";
import ImportWorkbookButton from "../../../components/workbook/ImportWorkbookButton";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useResource } from "../../../hooks/useResource";
import { useSalesReport } from "../../../hooks/useSalesReport";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { dateKey, periodStart, type Period } from "../../../domain/overview";
import { queryService } from "../../../services/query";
import { overviewBalanceSortColumns, overviewSalesSortColumns } from "../../../domain/sortColumns";
import { paths } from "../../paths";

/** Summary of one period; the id is `from|to` so the period change reloads it. */
const loadSummary = (range: string, signal: AbortSignal) => {
  const [from, to] = range.split("|");
  return queryService.summary({ from: from || undefined, to }, signal);
};

export default function OverviewRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("all");
  const today = new Date();
  const end = dateKey(today);
  const start = periodStart(period, today);
  const range = { from: start || undefined, to: end };
  const financial = useSalesReport(range, workspace.dataVersion);
  const summary = useResource(loadSummary, `${start}|${end}`, workspace.dataVersion,
    "Não foi possível carregar o resumo do período.");
  const progress = usePagedQuery({
    fetcher: queryService.balances, filters: range, version: workspace.dataVersion, defaultPageSize: 10,
    defaultSort: { sortBy: "date", descending: true }, errorMessage: "Não foi possível carregar as produções do período.",
  });
  const productions = usePagedQuery({
    fetcher: queryService.balances, filters: range, version: workspace.dataVersion,
    defaultSort: { sortBy: "date", descending: true }, errorMessage: "Não foi possível carregar as produções do período.",
  });
  const recentSales = usePagedQuery({
    fetcher: queryService.sales, filters: range, version: workspace.dataVersion,
    defaultSort: { sortBy: "date", descending: true }, errorMessage: "Não foi possível carregar as vendas do período.",
  });
  return (
    <OverviewPage
      period={period}
      onPeriodChange={setPeriod}
      range={{ start, end }}
      summary={summary.data}
      financial={financial}
      summaryStatus={summary.status === "ready" ? "ready" : summary.status === "loading" ? "loading" : "error"}
      progress={{ ...listControls(progress), items: progress.items }}
      productions={{ ...listControls(productions, overviewBalanceSortColumns), items: productions.items }}
      recentSales={{ ...listControls(recentSales, overviewSalesSortColumns), items: recentSales.items }}
      recipeCount={workspace.counts.recipes}
      marketCount={workspace.counts.market}
      onViewSales={() => navigate(paths.sales)}
      onViewProduction={(id) =>
        navigate(id ? paths.production(id) : paths.productions)
      }
      importAction={
        <ImportWorkbookButton onImport={workspace.importWorkbook} />
      }
    />
  );
}
