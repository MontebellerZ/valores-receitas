import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath } from "node:url";

let server;
const root = fileURLToPath(new URL("../", import.meta.url));
const noop = () => {};
const pagination = { page: 1, pageSize: 50, totalCount: 2, totalPages: 1, busy: false,
  onPageChange: noop, onPageSizeChange: noop };
const report = {
  totals: { count: 4, packages: 10, donatedPackages: 3, pendingCount: 1, customers: 2,
    revenue: 200, received: 150, pending: 50, cost: 80, donationCost: 24 },
  daily: { items: [{ date: "2026-10-01", packages: 6, revenue: 150 }, { date: "2026-10-02", packages: 4, revenue: 50 }],
    page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
  topProducts: [{ name: "Brownie", packages: 10, revenue: 200, cost: 80 }],
  topBuyers: [{ customer: "Ana", packages: 8, spent: 150 }, { customer: "", packages: 2, spent: 50 }],
};
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

before(async () => {
  server = await createServer({ root, server: { middlewareMode: true, hmr: false }, logLevel: "silent" });
});
after(async () => { await server?.close(); });

test("sales overview distinguishes profit, donations, ticket and collections with accessible daily values", async () => {
  const { default: Overview } = await server.ssrLoadModule("/src/components/sales/SalesOverview/index.tsx");
  const { money } = await server.ssrLoadModule("/src/utils/format.ts");
  const html = render(Overview, { report, pagination, onPending: noop });
  for (const value of [200, 120, 50, 150, 80, 24, 96]) assert.ok(html.includes(money(value)), money(value));
  assert.match(html, /60% de margem/);
  assert.match(html, /75%/);
  assert.match(html, /max="100" value="75"/);
  assert.match(html, /Cliente não informado/);
  assert.match(html, /resultado R\$\s120,00/);
  assert.match(html, /<button[^>]*>Consultar pagamentos pendentes/);
  assert.match(html, /Ver valores por dia/);
  assert.match(html, /Maior faturamento nesta página/);
  assert.match(html, /não é saldo em caixa/);
  assert.match(html, /3 pacote\(s\) doado\(s\), fora das vendas/);
});

test("empty, free and loss-making periods never fabricate averages, margins or positive results", async () => {
  const { default: Overview } = await server.ssrLoadModule("/src/components/sales/SalesOverview/index.tsx");
  const empty = { totals: Object.fromEntries(Object.keys(report.totals).map((key) => [key, 0])),
    daily: { ...report.daily, items: [], totalCount: 0, totalPages: 0 }, topProducts: [], topBuyers: [] };
  const html = render(Overview, { report: empty, pagination, onPending: noop });
  assert.match(html, /Não há vendas neste período/);
  assert.match(html, /Sem faturamento para calcular a margem/);
  assert.match(html, /Ticket médio<\/dt><dd>—/);
  assert.doesNotMatch(html, /NaN|Infinity|Consultar pagamentos pendentes/);
  const loss = render(Overview, { report: { ...report, totals: { ...report.totals, revenue: 20, received: 0, pending: 20 } }, pagination, onPending: noop });
  assert.match(loss, /-300% de margem/);
  assert.match(loss, /-R\$\s60,00/);
  const free = render(Overview, { report: { ...empty, totals: { ...empty.totals, count: 1, packages: 1, cost: 5 } }, pagination, onPending: noop });
  assert.match(free, /Sem faturamento para calcular a margem/);
  assert.doesNotMatch(free, /NaN|Infinity/);
});

test("sales report adapter rejects missing totals and malformed ranks instead of displaying false zeros", async () => {
  const { toSalesReport } = await server.ssrLoadModule("/src/services/query.ts");
  assert.deepEqual(toSalesReport(report), report);
  for (const invalid of [null, {}, { ...report, totals: {} }, { ...report, topProducts: [{ name: "X" }] },
    { ...report, topBuyers: [{ customer: "Ana", packages: 2, spent: "10" }] },
    { ...report, daily: { ...report.daily, items: [{ packages: 1, revenue: 10 }] } }]) {
    assert.throws(() => toSalesReport(invalid), /Resposta inesperada da API/);
  }
});

test("sales page retains history actions and clearly separates global balances and local filters", async () => {
  const { default: SalesPage } = await server.ssrLoadModule("/src/pages/sales/SalesPage/index.tsx");
  const controls = { pagination, status: "ready", serverSort: { columns: {} } };
  const props = {
    period: "month", onPeriodChange: noop, range: { from: "2026-10-01", to: "2026-10-28" },
    payment: "pending", onPaymentChange: noop, report: { data: report, status: "ready", pagination },
    balances: { ...controls, items: [] },
    sales: { ...controls, items: [{ id: "s1", productionId: "p1", recipeName: "Brownie", productionDate: "2026-10-01",
      date: "2026-10-02", customer: "Ana", notes: "Entregar à tarde", packages: 2, pricePerPackage: 25, paid: false }] },
    productionFilter: { id: "" }, onProductionFilter: noop, search: "", onSearch: noop,
    onCreate: noop, onEdit: noop, onDelete: noop, onViewProduction: noop,
  };
  const html = render(SalesPage, props);
  assert.match(html, /id="sales-history"/);
  assert.match(html, /filtram apenas este histórico/);
  assert.match(html, /aria-pressed="true"[^>]*>A receber/);
  assert.match(html, /Editar venda de Brownie para Ana/);
  assert.match(html, /Excluir venda de Brownie para Ana/);
  assert.match(html, /Visualizar produção de Brownie/);
  assert.match(html, /independente do período/);
  assert.match(html, /Entregar à tarde/);
  const loading = render(SalesPage, { ...props, report: { status: "loading", pagination } });
  assert.match(loading, /Carregando indicadores/);
  assert.doesNotMatch(loading, /PANORAMA DE VENDAS/);
  const error = render(SalesPage, { ...props, report: { status: "error", pagination } });
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /PANORAMA DE VENDAS/);
});
