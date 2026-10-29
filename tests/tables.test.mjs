import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server, DataTable, compareSortValues;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false }, logLevel: "silent",
  });
  ({ default: DataTable } = await server.ssrLoadModule("/src/components/ui/DataTable/index.tsx"));
  ({ compareSortValues } = await server.ssrLoadModule("/src/utils/sorting.ts"));
});
after(async () => { await server?.close(); });

const render = (Component, props) => renderToStaticMarkup(h(Component, props));
const rowIds = (html) => [...html.matchAll(/<tr data-id="([^"]+)"/g)].map((match) => match[1]);

test("sorting compares raw numbers, ISO dates and Portuguese text rather than formatted labels", () => {
  const sort = (values, direction = "ascending") => [...values].sort((a, b) => compareSortValues(a, b, direction));
  assert.deepEqual(sort([1000, 9.98, 100, -20, 0]), [-20, 0, 9.98, 100, 1000]);
  assert.deepEqual(sort([1000, 9.98, 100, -20, 0], "descending"), [1000, 100, 9.98, 0, -20]);
  assert.deepEqual(sort(["2026-10-01", "2026-09-30", "2025-12-31"], "descending"),
    ["2026-10-01", "2026-09-30", "2025-12-31"]);
  assert.deepEqual(sort(["Sal", "farinha", "Açúcar"]), ["Açúcar", "farinha", "Sal"]);
  assert.deepEqual(sort(["Pacote 10", "Pacote 2"]), ["Pacote 2", "Pacote 10"]);
  assert.equal(compareSortValues("AÇÚCAR", "açucar", "ascending"), 0);
  for (const direction of ["ascending", "descending"]) {
    assert.equal(compareSortValues(null, undefined, direction), 0);
    assert.ok(compareSortValues(null, 0, direction) > 0);
    assert.ok(compareSortValues(0, undefined, direction) < 0);
  }
});

test("shared tables sort stably without mutating rows and expose accessible non-submit headers", () => {
  const rows = [
    h("tr", { key: "high", "data-id": "high" }, h("td", { "data-sort-value": 1000 }, "R$ 1.000,00"), h("td", null, "Excluir")),
    h("tr", { key: "low", "data-id": "low" }, h("td", { "data-sort-value": 9 }, "R$ 9,00"), h("td", null, "Excluir")),
    h("tr", { key: "tie", "data-id": "tie" }, h("td", { "data-sort-value": 9 }, "R$ 9,00"), h("td", null, "Excluir")),
  ];
  const children = [
    h("caption", { key: "caption" }, "Compras"),
    h("thead", { key: "head" }, h("tr", null, h("th", null, "Preço"), h("th", null, "Ações"))),
    h("tbody", { key: "body" }, rows),
    h("tfoot", { key: "foot" }, h("tr", null, h("td", { colSpan: 2 }, "Total"))),
  ];
  const ascending = render(DataTable, { defaultSort: { column: 0, direction: "ascending" }, children });
  assert.deepEqual(rowIds(ascending), ["low", "tie", "high"]);
  assert.match(ascending, /scope="col" aria-sort="ascending"/);
  assert.match(ascending, /title="Ordenar em ordem decrescente" type="button"/);
  assert.match(ascending, /<th>Ações<\/th>/);
  assert.match(ascending, /<caption>Compras<\/caption>/);
  assert.match(ascending, /<tfoot>/);
  assert.deepEqual(rowIds(render(DataTable, { defaultSort: { column: 0, direction: "descending" }, children })), ["high", "low", "tie"]);
  assert.deepEqual(rowIds(render(DataTable, { children })), ["high", "low", "tie"]);
  assert.deepEqual(rows.map((row) => row.props["data-id"]), ["high", "low", "tie"]);
});

const controls = (items, columns, sortBy, descending = false, onSort = () => {}) => ({
  items,
  pagination: { page: 1, pageSize: 10, totalCount: items.length, totalPages: 1, busy: false,
    onPageChange: () => {}, onPageSizeChange: () => {} },
  serverSort: { columns, sortBy, descending, onSort },
  status: "ready",
});

test("server-sorted tables render rows as received and only map columns accepted by the API", () => {
  const sorts = [];
  const rows = [
    h("tr", { key: "b", "data-id": "b" }, h("td", { "data-sort-value": 2 }, "B"), h("td", { "data-sort-value": 1 }, "1")),
    h("tr", { key: "a", "data-id": "a" }, h("td", { "data-sort-value": 1 }, "A"), h("td", { "data-sort-value": 2 }, "2")),
  ];
  const html = render(DataTable, {
    serverSort: { columns: { 0: "name" }, sortBy: "name", descending: true, onSort: (...args) => sorts.push(args) },
    children: [h("thead", { key: "head" }, h("tr", null, h("th", null, "Nome"), h("th", null, "Total"))),
      h("tbody", { key: "body" }, rows)],
  });
  assert.deepEqual(rowIds(html), ["b", "a"]);
  assert.equal((html.match(/aria-sort=/g) ?? []).length, 1);
  assert.match(html, /aria-sort="descending"[^>]*><button[^>]*title="Ordenar em ordem crescente"[^>]*>Nome/);
  assert.match(html, /<th>Total<\/th>/);
  assert.deepEqual(sorts, []);
});

test("stock lists the server page in the requested order with the purchase column sorted newest first", async () => {
  const { default: StockPage } = await server.ssrLoadModule("/src/pages/stock/StockPage/index.tsx");
  const { stockSortColumns } = await server.ssrLoadModule("/src/domain/sortColumns.ts");
  const base = { marketItemId: "flour", itemName: "Farinha", unit: "g", packageQty: 1000, packagePrice: 10,
    remainingQty: 1000, isActive: true, purchaseLotCount: 1, purchaseMixedItems: false };
  const stock = [
    { ...base, id: "new-late", entryOrder: 3, entryDate: "2026-10-20" },
    { ...base, id: "new-early", entryOrder: 2, entryDate: "2026-10-20" },
    { ...base, id: "old", entryOrder: 1, entryDate: "2026-09-30" },
  ];
  const html = render(StockPage, {
    lots: controls(stock, stockSortColumns, "entryOrder", true),
    totals: { ...controls([{ id: "flour", name: "Farinha", unit: "g", quantity: 3000 }], {}), serverSort: undefined },
    marketCount: 1, search: "", onSearch: () => {}, showInactive: false, onShowInactive: () => {},
    loadPurchase: async () => [], disabled: false,
    addStock: async () => {}, updateStock: async () => {}, adjustStock: async () => {}, deleteStock: async () => {},
  });
  const ids = [...html.matchAll(/aria-label="Editar pacote ([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["new-late", "new-early", "old"]);
  assert.match(html, /aria-sort="descending"[^>]*><button[^>]*title="Ordenar em ordem crescente"[^>]*>Compra/);
  assert.equal((html.match(/aria-sort=/g) ?? []).length, 5);
  assert.match(html, /<th>Ações<\/th>/);
});

test("all table consumers expose server-sortable data columns while preserving action columns", async () => {
  const columns = await server.ssrLoadModule("/src/domain/sortColumns.ts");
  const { default: Market } = await server.ssrLoadModule("/src/pages/market/MarketPage/index.tsx");
  const { default: Ingredients } = await server.ssrLoadModule("/src/components/recipes/RecipeIngredientsEditor/index.tsx");
  const { default: Sales } = await server.ssrLoadModule("/src/pages/sales/SalesPage/index.tsx");
  const { default: Overview } = await server.ssrLoadModule("/src/pages/overview/OverviewPage/index.tsx");
  const { default: RealizedSales } = await server.ssrLoadModule("/src/components/production/RealizedSales/index.tsx");
  const { default: Detail } = await server.ssrLoadModule("/src/pages/production/ProductionDetailPage/index.tsx");
  const market = [{ id: "flour", name: "Farinha", unit: "g", ingredientCount: 1 }];
  const production = {
    id: "bread", recipeId: "recipe", recipeName: "Pão", date: "2026-10-20", quantity: 1, actualYield: 10,
    losses: 0, margin: 50, packageQty: 1, yieldPerBatch: 10, ingredientCostPerBatch: 5, totalCost: 5,
    cost: 5, produced: 10, packages: 10, costPerPackage: 0.5, salePrice: 1, revenue: 10, profit: 5,
  };
  const balance = { ...production, soldPackages: 2, availablePackages: 8,
    periodSales: { count: 1, packages: 2, revenue: 6, cost: 1 } };
  const sale = { id: "sale", productionId: "bread", productionDate: production.date, recipeName: "Pão",
    date: "2026-10-20", packages: 2, pricePerPackage: 3, costPerPackage: 0.5, customer: "Ana", paid: true, notes: "",
    cumulativeRevenue: 6 };
  const totals = { salesCount: 1, outPackages: 2, donatedPackages: 0, revenue: 6, received: 6, pending: 0,
    soldCost: 1, firstSaleDate: sale.date };
  const report = { ...totals, topBuyers: [{ customer: "Ana", packages: 2, spent: 6 }],
    daily: { items: [{ date: sale.date, sold: 2, donated: 0, total: 2, revenue: 6, cumulativeRevenue: 6 }],
    page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } };
  const summary = {
    revision: 1, counts: { market: 1, recipes: 1, productions: 1, sales: 1 },
    sales: { count: 1, packages: 2, revenue: 6, received: 6, pending: 0, pendingCount: 0, cost: 1, profit: 5 },
    availablePackages: 8, productionCost: 5, producedPackages: 10, lostPackages: 0,
    productions: { count: 1, soldPackages: 2, losses: 0, remainingRevenue: 8, remainingCost: 4,
      expectedRevenue: 10, referenceRevenue: 10, referenceProfit: 5 },
  };
  const noop = () => {};
  const salesProps = (items) => ({
    report: { status: "loading", pagination: controls([], {}).pagination },
    period: "month", onPeriodChange: noop, range: { from: "2026-10-01", to: "2026-10-31" },
    payment: "", onPaymentChange: noop,
    summary, balances: controls([balance], columns.balanceSortColumns, "recipeName"),
    sales: controls(items, columns.salesSortColumns, "date", true), productionFilter: { id: "" },
    onProductionFilter: noop, search: "", onSearch: noop, onCreate: noop, onEdit: noop, onDelete: noop, onViewProduction: noop,
  });
  const cases = [
    [Market, { ...controls(market, columns.marketSortColumns, "name"), created: [], totalCount: 1, search: "", onSearch: noop,
      updateMarket: noop, addMarketItem: noop, onRequestDelete: noop }, 2],
    [Ingredients, { ...controls([], columns.recipeIngredientSortColumns, "name"),
      rows: [{ id: "ingredient", marketItemId: "flour", quantity: 100 }], totalCount: 1, selectedIds: ["flour"],
      hasEmptyRow: false, marketCount: 1, onChange: noop, onAdd: noop, onRemove: noop }, 3],
    [Sales, salesProps([sale]), 11],
    [Overview, { period: "month", onPeriodChange: noop, range: { start: "2026-10-01", end: "2026-10-31" }, summary,
      summaryStatus: "ready", progress: controls([balance], {}), productions: controls([balance], columns.overviewBalanceSortColumns),
      recentSales: controls([sale], columns.overviewSalesSortColumns), recipeCount: 1, marketCount: 1, importAction: null,
      onViewSales: noop, onViewProduction: noop }, 11],
    [RealizedSales, { report: totals, sales: controls([sale], columns.realizedSalesSortColumns, "date"), onViewSales: noop }, 6],
    [Detail, { production, report: { data: report, status: "ready", pagination: controls([], {}).pagination },
      sales: controls([sale], columns.realizedSalesSortColumns, "date"),
      consumptions: controls([{ stockLotId: "lot", itemName: "Farinha", entryDate: "2026-10-19", quantity: 100, unit: "g", cost: 5 }],
        columns.consumptionSortColumns),
      updateProduction: noop, saveProduction: async () => {}, onRequestDelete: noop, onBack: noop, onViewSales: noop }, 10],
  ];
  for (const [Component, props, count] of cases) {
    assert.equal((render(Component, props).match(/aria-sort=/g) ?? []).length, count, Component.name);
  }
  assert.match(render(RealizedSales, cases[4][1]), /Faturamento acumulado[\s\S]*R\$\s6,00/);
  for (const [paid, label] of [[false, "A receber"], [true, "Recebido"]]) {
    const html = render(Sales, salesProps([{ ...sale, paid }]));
    assert.match(html, new RegExp(`<td[^>]*><span[^>]*>${label}</span></td>`));
  }
});
