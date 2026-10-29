import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import XLSX from "xlsx";

let server;
let calculations;
let rules;
let overview;
let storage;
let workbookService;
let navigation;
let productionReport;

const item = {
  id: "market-test",
  name: "Farinha",
  unit: "g",
  packageQty: 1000,
  packagePrice: 10,
};
const recipe = {
  id: "recipe-test",
  name: "Pao",
  category: "Panificacao",
  yield: 10,
  hoursPerBatch: 1,
  ingredients: [
    { id: "ingredient-test", marketItemId: item.id, quantity: 500 },
  ],
};
const production = {
  id: "production-test",
  recipeId: recipe.id,
  recipeName: recipe.name,
  date: "2026-10-16",
  quantity: 2,
  actualYield: 20,
  losses: 2,
  margin: 50,
  packageQty: 3,
  yieldPerBatch: 10,
  ingredientCostPerBatch: 5,
};
const draft = {
  productionId: production.id,
  date: production.date,
  packages: 2,
  pricePerPackage: 3,
  customer: "Teste",
  paid: true,
  notes: "",
};

before(async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  server = await createServer({
    root,
    server: { middlewareMode: true, hmr: false },
    logLevel: "silent",
  });
  calculations = await server.ssrLoadModule("/src/domain/calculations.ts");
  rules = await server.ssrLoadModule("/src/domain/workspaceRules.ts");
  overview = await server.ssrLoadModule("/src/domain/overview.ts");
  storage = await server.ssrLoadModule("/src/services/storage.ts");
  workbookService = await server.ssrLoadModule("/src/services/workbook.ts");
  navigation = await server.ssrLoadModule("/src/app/paths.ts");
  productionReport = await server.ssrLoadModule("/src/domain/productionReport.ts");
});

after(async () => {
  await server?.close();
});

const target = (calculated, soldPackages = 0) => ({ production: calculated, soldPackages });

test("sales cart preserves independent data and historical costs with unique sale identifiers", () => {
  const calculated = calculations.calculateProduction(production);
  const other = { ...calculated, id: "other-production", recipeName: "Bolo", costPerPackage: 7 };
  const result = rules.prepareSales([
    draft,
    { ...draft, productionId: other.id, date: "2026-10-18", packages: 1,
      pricePerPackage: 12.5, customer: "Outro cliente", paid: false, notes: "Entregar amanhã" },
  ], [target(calculated), target(other)]);
  assert.equal(result.error, undefined);
  assert.equal(result.sales.length, 2);
  assert.notEqual(result.sales[0].id, result.sales[1].id);
  assert.equal(result.sales[0].costPerPackage, calculated.costPerPackage);
  assert.equal(result.sales[1].costPerPackage, 7);
  for (const [key, value] of Object.entries({
    productionId: other.id, date: "2026-10-18", packages: 1, pricePerPackage: 12.5,
    customer: "Outro cliente", paid: false, notes: "Entregar amanhã",
  })) assert.equal(result.sales[1][key], value);
});

test("donated sales are free, never pending and keep consuming packages", () => {
  const calculated = calculations.calculateProduction(production);
  const donated = rules.prepareSale({ ...draft, donated: true, paid: false, pricePerPackage: 9 }, calculated, 0).sale;
  assert.equal(donated.donated, true);
  assert.equal(donated.paid, true);
  assert.equal(donated.pricePerPackage, 0);
  assert.equal(donated.packages, draft.packages);
  assert.equal(rules.prepareSale(draft, calculated, 0).sale.donated, false);
});

test("sales cart validates combined packages against the server sold total without partial results", () => {
  const calculated = calculations.calculateProduction(production);
  const drafts = [draft, { ...draft, packages: 3 }];
  const valid = rules.prepareSales(drafts, [target(calculated, 1)]);
  assert.equal(valid.error, undefined);
  assert.equal(valid.sales.reduce((sum, sale) => sum + sale.packages, 1), calculated.packages);
  const invalid = rules.prepareSales([draft, { ...draft, packages: 4 }], [target(calculated, 1)]);
  assert.match(invalid.error, /Venda 2:.*apenas 3 pacotes/);
  assert.equal(invalid.sales, undefined);
  assert.deepEqual(drafts, [draft, { ...draft, packages: 3 }]);
});

test("sales cart rejects empty carts, editing and invalid individual fields", () => {
  const calculated = calculations.calculateProduction(production);
  assert.match(rules.prepareSales([], [target(calculated)]).error, /pelo menos uma venda/);
  assert.match(rules.prepareSales([{ ...draft, id: "existing" }], [target(calculated)]).error, /novas vendas/);
  for (const patch of [
    { productionId: "missing" }, { packages: 1.5 }, { packages: 0 },
    { pricePerPackage: -1 }, { pricePerPackage: NaN }, { date: "2026-10-15" },
  ]) {
    const result = rules.prepareSales([draft, { ...draft, ...patch }], [target(calculated)]);
    assert.match(result.error, /^Venda 2:/);
    assert.equal(result.sales, undefined);
  }
});

test("route helpers encode identifiers and preserve internal return URLs", () => {
  assert.equal(
    navigation.paths.recipe("recipe/with space"),
    "/receitas/recipe%2Fwith%20space",
  );
  assert.equal(
    navigation.paths.production("production-test"),
    "/producao/production-test",
  );
  assert.equal(
    navigation.paths.saleEdit("sale-test"),
    "/vendas/sale-test/editar",
  );
  assert.equal(
    navigation.getLoginDestination("/receitas/recipe-test?view=detail"),
    "/receitas/recipe-test?view=detail",
  );
});

test("login return URLs reject external addresses and authentication loops", () => {
  for (const value of [
    undefined,
    "https://example.invalid",
    "//example.invalid",
    "/\\example.invalid",
    "/login?next=/vendas",
    "/cadastro",
  ]) {
    assert.equal(navigation.getLoginDestination(value), "/");
  }
});

test("recipe and production costs retain yields, losses and markup", () => {
  assert.equal(calculations.unitCost(item), 0.01);
  assert.equal(calculations.recipeCostPerBatch(recipe, [item]), 5);
  const calculated = calculations.calculateProduction(production);
  assert.equal(calculated.cost, 10);
  assert.equal(calculated.produced, 18);
  assert.equal(calculated.packages, 6);
  assert.equal(calculated.salePrice, 2.5);
  assert.equal(
    calculations.calculateProduction({ ...production, actualYield: 0 })
      .packages,
    0,
  );
});

test("sales reject invalid dates, stock, prices and missing productions", () => {
  const calculated = calculations.calculateProduction(production);
  assert.ok(rules.prepareSale(draft, calculated, 0).sale);
  for (const patch of [
    { packages: 7 },
    { packages: 0.5 },
    { pricePerPackage: -1 },
    { date: "2026-10-15" },
    { productionId: "missing" },
  ]) {
    assert.ok(rules.prepareSale({ ...draft, ...patch }, calculated, 0).error);
  }
  assert.ok(rules.prepareSale(draft, null, 0).error);
  assert.match(rules.prepareSale({ ...draft, packages: 2 }, calculated, 5).error, /apenas 1 pacotes/);
});

test("editing a sale keeps historical cost and excludes its own stock", () => {
  const calculated = calculations.calculateProduction(production);
  const created = rules.prepareSale(draft, calculated, 0).sale;
  const historical = { ...created, id: "sale-test", costPerPackage: 1.25 };
  // Sold by others excludes the edited sale, so all six packages remain available to it.
  const edited = rules.prepareSale({ ...draft, id: historical.id, packages: 6 }, calculated, 0, historical);
  assert.equal(edited.sale.id, historical.id);
  assert.equal(edited.sale.costPerPackage, 1.25);
  assert.equal(edited.sale.productionDate, historical.productionDate);
  assert.match(rules.prepareSale({ ...draft, id: "missing" }, calculated, 0, historical).error, /não está mais disponível/);
});

const stats = (soldPackages, firstSaleDate = production.date) =>
  ({ salesCount: soldPackages > 0 ? 1 : 0, soldPackages, firstSaleDate: soldPackages > 0 ? firstSaleDate : null });

test("lost packages reduce sellable stock and forecast without changing cost per package", () => {
  const calculated = calculations.calculateProduction({ ...production, lostPackages: 2 });
  assert.equal(calculated.packages, 6);
  assert.equal(calculated.costPerPackage, calculations.calculateProduction(production).costPerPackage);
  assert.equal(calculations.remainingPackages(calculated), 4);
  assert.equal(calculations.remainingPackages(calculated, 3), 1);
  assert.equal(calculated.revenue, 10);
  assert.equal(calculated.profit, 0);
  assert.ok(rules.prepareSale({ ...draft, packages: 4 }, calculated, 0).sale);
  assert.match(rules.prepareSale({ ...draft, packages: 5 }, calculated, 0).error, /apenas 4 pacotes/);

  assert.equal(rules.validateProductionUpdate(production, { lostPackages: 3 }, stats(3)), undefined);
  for (const lostPackages of [4, -1, 1.5]) {
    assert.ok(rules.validateProductionUpdate(production, { lostPackages }, stats(3)));
  }
});

const totals = {
  salesCount: 3, outPackages: 4, donatedPackages: 1, revenue: 10, received: 6, pending: 4,
  soldCost: 0, firstSaleDate: "2026-10-16",
};

test("production report summarizes server totals into package destinations, yield and financial results", () => {
  const calculated = calculations.calculateProduction({ ...production, lostPackages: 1 });
  const report = productionReport.buildProductionReport(calculated, totals);
  assert.equal(report.salesCount, 3);
  assert.deepEqual([report.soldPackages, report.donatedPackages, report.lostPackages, report.availablePackages], [3, 1, 1, 1]);
  assert.deepEqual([report.revenue, report.received, report.pending], [10, 6, 4]);
  assert.equal(report.result, 0);
  assert.equal(report.costRecovery, 1);
  assert.equal(report.status, "selling");
  assert.equal(report.expectedYield, 20);
  assert.equal(report.lossRate, 0.1);
  assert.equal(report.averagePrice, 10 / 3);
  assert.ok(Math.abs(report.giveawayCost - 2 * calculated.costPerPackage) < 1e-9);
  assert.ok(Math.abs(report.projectedRevenue - 12.5) < 1e-9);
  assert.ok(Math.abs(report.projectedResult - 2.5) < 1e-9);
  assert.ok(Math.abs(report.missedRevenue - 2 * calculated.salePrice) < 1e-9);
  assert.ok(Math.abs(report.expectedRevenue - 6 * calculated.salePrice) < 1e-9);
  assert.ok(Math.abs(report.revenueGap - (10 - 6 * calculated.salePrice)) < 1e-9);
  assert.ok(Math.abs(report.profitGap - (0 - report.expectedProfit)) < 1e-9);
  const empty = { ...totals, salesCount: 0, outPackages: 0, donatedPackages: 0, revenue: 0, received: 0, pending: 0, firstSaleDate: null };
  assert.equal(productionReport.buildProductionReport(calculated, empty).status, "waiting");
  assert.equal(productionReport.buildProductionReport({ ...calculated, lostPackages: 6 }, empty).status, "closed");
});

test("daily report pages keep the server accumulated revenue, fill short gaps and compute expiration", () => {
  const row = (date, sold, revenue, cumulativeRevenue) =>
    ({ date, sold, donated: 0, total: sold, revenue, cumulativeRevenue });
  // A middle page: accumulated revenue already includes the previous pages.
  const filled = productionReport.fillDailyGaps([row("2026-10-18", 2, 6, 40), row("2026-10-16", 1, 4, 34)]);
  assert.deepEqual(filled.map((day) => [day.date, day.total, day.cumulativeRevenue]),
    [["2026-10-16", 1, 34], ["2026-10-17", 0, 34], ["2026-10-18", 2, 40]]);
  assert.deepEqual(productionReport.fillDailyGaps([]), []);
  const longGap = productionReport.fillDailyGaps([row("2026-10-16", 1, 1, 1), row("2027-03-01", 1, 1, 2)]);
  assert.deepEqual(longGap.map((day) => day.date), ["2026-10-16", "2027-03-01"]);
  assert.equal(productionReport.expirationDate("2026-10-16", 20), "2026-11-05");
  assert.equal(productionReport.expirationDate("2026-10-16", 0), "2026-10-16");
  assert.equal(productionReport.expirationDate("2026-10-16", null), null);
});

test("production changes cannot invalidate existing sales", () => {
  for (const patch of [
    { packageQty: 2 },
    { recipeId: "other" },
    { actualYield: 3 },
    { date: "2026-10-17" },
  ]) {
    assert.ok(rules.validateProductionUpdate(production, patch, stats(2)));
  }
  assert.equal(rules.validateProductionUpdate(production, { margin: 80 }, stats(2)), undefined);
});

test("financial summaries and periods retain their results", () => {
  assert.equal(overview.balance(0.1 + 0.2, 0.3), 0);
  assert.equal(
    overview.periodStart("week", new Date(2026, 9, 16)),
    "2026-10-10",
  );
  assert.equal(overview.periodStart("all", new Date(2026, 9, 16)), "");
});

test("storage keeps account caches separate and handles invalid JSON", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const memory = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    },
  });
  try {
    const snapshot = {
      market: [item],
      recipes: [recipe],
      productions: [production],
      sales: [],
    };
    storage.writeSavedData("test-user", snapshot);
    assert.equal(storage.readSavedData("test-user").market[0].id, item.id);
    assert.equal("packageQty" in storage.readSavedData("test-user").market[0], false);
    assert.equal("packagePrice" in storage.readSavedData("test-user").market[0], false);
    memory.set("legacy", JSON.stringify({ market: [item], recipes: [{ ...recipe, quantity: 2 }] }));
    assert.equal(storage.readSavedData("legacy").productions[0].ingredientCostPerBatch, 5);
    assert.equal(storage.readSavedData("other-user").market.length, 0);
    assert.equal(storage.hasLegacyMigration(), false);
    storage.markLegacyMigrated();
    assert.equal(storage.hasLegacyMigration(), true);
    memory.set("invalid-json", "{");
    assert.equal(storage.readSavedData("invalid-json").recipes.length, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

test("XLSX import links recipe ingredients to imported market items", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      { Item: "Farinha", Unidade: "g", "Qtd pacote": 1000, "Valor pacote": 10 },
    ]),
    "Mercado",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        Receita: "Pao",
        Rendimento: 10,
        Item: "Farinha",
        "Quantidade ingrediente": 500,
      },
    ]),
    "Receitas",
  );
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const imported = await workbookService.importWorkbook(
    new File([bytes], "test.xlsx"),
  );
  assert.equal(imported.market.length, 1);
  assert.equal(imported.recipes.length, 1);
  assert.equal(
    imported.recipes[0].ingredients[0].marketItemId,
    imported.market[0].id,
  );
  assert.equal(imported.recipes[0].ingredients[0].quantity, 500);
});
