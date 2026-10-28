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

test("stock opens newest purchase dates first and uses entry order to break same-day ties", async () => {
  const { default: StockPage } = await server.ssrLoadModule("/src/pages/stock/StockPage/index.tsx");
  const base = { marketItemId: "flour", itemName: "Farinha", unit: "g",
    packageQty: 1000, packagePrice: 10, remainingQty: 1000, isActive: true };
  const stock = [
    { ...base, id: "old", entryOrder: 10, entryDate: "2026-09-30" },
    { ...base, id: "new-early", entryOrder: 2, entryDate: "2026-10-20" },
    { ...base, id: "new-late", entryOrder: 3, entryDate: "2026-10-20" },
    { ...base, id: "middle", entryOrder: 4, entryDate: "2026-10-01" },
  ];
  const html = render(StockPage, { market: [{ id: "flour", name: "Farinha", unit: "g" }], stock, disabled: false,
    addStock: async () => {}, updateStock: async () => {}, adjustStock: async () => {}, deleteStock: async () => {} });
  const ids = [...html.matchAll(/aria-label="Editar pacote ([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["new-late", "new-early", "middle", "old"]);
  assert.match(html, /aria-sort="descending"[^>]*><button[^>]*title="Ordenar em ordem crescente"[^>]*>Compra/);
  assert.equal((html.match(/aria-sort=/g) ?? []).length, 5);
  assert.match(html, /<th>Ações<\/th>/);
  assert.deepEqual(stock.map((lot) => lot.id), ["old", "new-early", "new-late", "middle"]);
});

test("all table consumers expose sortable data columns while preserving action columns", async () => {
  const { default: Market } = await server.ssrLoadModule("/src/pages/market/MarketPage/index.tsx");
  const { default: Ingredients } = await server.ssrLoadModule("/src/components/recipes/RecipeIngredientsEditor/index.tsx");
  const { default: Sales } = await server.ssrLoadModule("/src/pages/sales/SalesPage/index.tsx");
  const { default: Overview } = await server.ssrLoadModule("/src/pages/overview/OverviewPage/index.tsx");
  const { default: RealizedSales } = await server.ssrLoadModule("/src/components/production/RealizedSales/index.tsx");
  const { default: Detail } = await server.ssrLoadModule("/src/pages/production/ProductionDetailPage/index.tsx");
  const market = [{ id: "flour", name: "Farinha", unit: "g" }];
  const production = {
    id: "bread", recipeId: "recipe", recipeName: "Pão", date: "2026-10-20", quantity: 1, actualYield: 10,
    losses: 0, margin: 50, packageQty: 1, yieldPerBatch: 10, ingredientCostPerBatch: 5, totalCost: 5,
    cost: 5, produced: 10, packages: 10, costPerPackage: 0.5, salePrice: 1, revenue: 10, profit: 5,
  };
  const sale = { id: "sale", productionId: "bread", productionDate: production.date, recipeName: "Pão",
    date: "2026-10-20", packages: 2, pricePerPackage: 3, costPerPackage: 0.5, customer: "Ana", paid: true, notes: "" };
  const cases = [
    [Market, { market, recipes: [] }, 2],
    [Ingredients, { market, ingredients: [{ id: "ingredient", marketItemId: "flour", quantity: 100 }] }, 3],
    [Sales, { productions: [production], sales: [sale] }, 11],
    [Overview, { productions: [production], sales: [sale], recipeCount: 1, marketCount: 1 }, 11],
    [RealizedSales, { production, sales: [sale] }, 7],
    [Detail, { production, recipes: [], sales: [], consumptions: [
      { stockLotId: "lot", itemName: "Farinha", entryDate: "2026-10-19", quantity: 100, unit: "g", cost: 5 },
    ], consumptionStatus: "ready" }, 4],
  ];
  for (const [Component, props, count] of cases) {
    assert.equal((render(Component, props).match(/aria-sort=/g) ?? []).length, count, Component.name);
  }
  for (const [paid, value, label] of [[false, 0, "A receber"], [true, 1, "Recebido"]]) {
    const html = render(Sales, { productions: [production], sales: [{ ...sale, paid }] });
    assert.match(html, new RegExp(`<td data-sort-value="${value}"><span[^>]*>${label}</span></td>`));
  }
});
