import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server, Overview, money;
const noop = () => {};
const controls = {
  items: [], status: "ready",
  pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 0, busy: false,
    onPageChange: noop, onPageSizeChange: noop },
};
const summary = {
  revision: 1, counts: { market: 4, recipes: 3, productions: 2, sales: 3 },
  sales: { count: 3, packages: 8, revenue: 200, received: 150, pending: 50, pendingCount: 1, cost: 90, profit: 110 },
  producedPackages: 20, availablePackages: 10, productionCost: 160, lostPackages: 2,
  productions: { count: 2, soldPackages: 8, donatedPackages: 2, losses: 7, remainingRevenue: 250, remainingCost: 80,
    expectedRevenue: 450, referenceRevenue: 400, referenceProfit: 240 },
};
const report = {
  totals: { count: 2, packages: 6, donatedPackages: 2, pendingCount: 1, customers: 2,
    revenue: 200, received: 150, pending: 50, cost: 60, donationCost: 30 },
  daily: { items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
  topProducts: [{ name: "Bolo de cenoura", packages: 6, revenue: 200, cost: 60 }], topBuyers: [],
};
const props = {
  period: "month", onPeriodChange: noop, range: { start: "2026-10-01", end: "2026-10-29" },
  summary, summaryStatus: "ready", financial: { status: "ready", data: report },
  progress: controls, productions: controls, recentSales: controls, recipeCount: 3, marketCount: 4,
  importAction: null, onViewSales: noop, onViewProduction: noop,
};
const render = (overrides = {}) => renderToStaticMarkup(createElement(Overview, { ...props, ...overrides }));

before(async () => {
  server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false }, logLevel: "silent" });
  ({ default: Overview } = await server.ssrLoadModule("/src/pages/overview/OverviewPage/index.tsx"));
  ({ money } = await server.ssrLoadModule("/src/utils/format.ts"));
});
after(async () => { await server?.close(); });

test("business panorama uses global sales totals, deducts donations and separates forecasts", () => {
  const html = render();
  const hero = html.slice(html.indexOf('aria-label="Resultados do negócio"'), html.indexOf("No radar"));
  assert.ok(hero.includes(money(110)));
  assert.ok(hero.includes("55%"));
  assert.ok(hero.includes(money(200)));
  assert.ok(hero.includes(money(150)));
  assert.ok(hero.includes(money(50)));
  assert.ok(!hero.includes(money(450)));
  assert.match(hero, /não representa saldo em caixa/);
  assert.match(html, /Ticket médio[\s\S]*100,00/);
  assert.match(html, /Bolo de cenoura/);
  assert.match(html, /Pacotes perdidos<\/dt><dd>2<\/dd>/);
  assert.match(html, /Perdas no preparo<\/dt><dd>7 unidades/);
  assert.match(html, /75% do faturamento recebido/);
  assert.match(html, /Consultar vendas/);
});

test("loading and errors do not masquerade as zero-valued business results", () => {
  for (const status of ["loading", "error", "missing"]) {
    const html = render({ financial: { status }, summary: undefined,
      summaryStatus: status === "loading" ? "loading" : "error" });
    assert.ok(!html.includes('aria-label="Resultados do negócio"'));
    assert.ok(!html.includes('aria-label="Produção e estoque do período"'));
    assert.match(html, status === "loading" ? /role="status"/ : /role="alert"/);
  }
});

test("empty, zero-revenue and negative-result businesses get honest guidance", () => {
  const empty = { ...report, topProducts: [], totals: Object.fromEntries(Object.keys(report.totals).map((key) => [key, 0])) };
  const html = render({ financial: { status: "ready", data: empty } });
  assert.match(html, /A próxima venda começa aqui/);
  assert.match(html, /Sem faturamento para calcular a margem/);
  assert.ok(!/NaN|Infinity/.test(html));
  assert.ok(!html.includes("Pagamentos em dia"));
  const loss = render({ financial: { status: "ready", data: {
    ...report, totals: { ...report.totals, revenue: 20, received: 0, pending: 20 },
  } } });
  assert.match(loss, /O resultado está negativo/);
  assert.ok(loss.includes(money(-70)));
});

test("production turnover uses lifetime outflow, not period sales or a page total", () => {
  const html = render({ progress: { ...controls, items: [{
    id: "cake", recipeName: "Bolo", date: "2026-10-01", packages: 10,
    soldPackages: 8, donatedPackages: 2, availablePackages: 1, lostPackages: 1, salePrice: 20,
    periodSales: { count: 1, packages: 2, revenue: 40, cost: 10 },
  }] } });
  assert.match(html, /Vendidos: 6, Doados: 2, Perdidos: 1, Disponíveis: 1. Total: 10 pacotes/);
  assert.match(html, /90% com destino definido/);
  assert.match(html, /Doados/);
  assert.match(html, /Ver produção/);
});

test("turnover and stock opportunity fill the bar with losses when no packages remain", () => {
  const html = render({
    summary: { ...summary, producedPackages: 135, availablePackages: 0, lostPackages: 13,
      productions: { ...summary.productions, soldPackages: 122, donatedPackages: 14, losses: 20 } },
    progress: { ...controls, items: [{
      id: "cookies", recipeName: "Cookies", date: "2026-10-20", packages: 80,
      soldPackages: 67, donatedPackages: 14, lostPackages: 13, availablePackages: 0, salePrice: 6,
      periodSales: { count: 1, packages: 67, revenue: 354, cost: 185 },
    }] },
  });
  assert.match(html, /Vendidos: 53, Doados: 14, Perdidos: 13, Disponíveis: 0. Total: 80 pacotes/);
  assert.match(html, /width:66.25%/);
  assert.match(html, /width:17.5%/);
  assert.match(html, /width:16.25%/);
  assert.match(html, /100% com destino definido/);
  assert.match(html, /Vendidos: 108, Doados: 14, Perdidos: 13, Disponíveis: 0. Total: 135 pacotes/);
  assert.match(html, /100% dos pacotes com destino definido/);
});

test("destination bars preserve exact segment proportions and handle empty or fully lost production", async () => {
  const { default: Bar } = await server.ssrLoadModule("/src/components/ui/PackageDestinationBar/index.tsx");
  const renderBar = (values) => renderToStaticMarkup(createElement(Bar, { label: "Destino", donated: 0, ...values }));
  const mixed = renderBar({ total: 10, sold: 4, donated: 2, lost: 1, available: 3 });
  assert.deepEqual([...mixed.matchAll(/style="width:([^"]+)"/g)].map((match) => match[1]), ["40%", "20%", "10%", "30%"]);
  for (const label of ["Vendidos", "Doados", "Perdidos", "Disponíveis"]) assert.ok(mixed.includes(label));
  assert.match(mixed, /title="Vendidos: 4 pacotes \(40%\)"/);
  assert.match(mixed, /<strong>4<\/strong>/);
  assert.ok(!mixed.includes("<small>"));
  const lost = renderBar({ total: 10, sold: 0, lost: 10, available: 0 });
  assert.deepEqual([...lost.matchAll(/style="width:([^"]+)"/g)].map((match) => match[1]), ["100%"]);
  assert.match(lost, /title="Perdidos: 10"/);
  const sold = renderBar({ total: 10, sold: 10, lost: 0, available: 0 });
  assert.match(sold, /style="width:100%" title="Vendidos: 10"/);
  const empty = renderBar({ total: 0, sold: 0, lost: 0, available: 0 });
  assert.ok(!/NaN|Infinity|style="width:/.test(empty));
  assert.match(empty, /Total: 0 pacotes/);
});
