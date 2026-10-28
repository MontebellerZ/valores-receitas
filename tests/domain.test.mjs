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

test("sales cart preserves independent data and historical costs with unique sale identifiers", () => {
  const calculated = calculations.calculateProduction(production);
  const other = { ...calculated, id: "other-production", recipeName: "Bolo", costPerPackage: 7 };
  const result = rules.prepareSales([
    draft,
    { ...draft, productionId: other.id, date: "2026-10-18", packages: 1,
      pricePerPackage: 12.5, customer: "Outro cliente", paid: false, notes: "Entregar amanhã" },
  ], [calculated, other], []);
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
  const donated = rules.prepareSale({ ...draft, donated: true, paid: false, pricePerPackage: 9 }, [calculated], []).sale;
  assert.equal(donated.donated, true);
  assert.equal(donated.paid, true);
  assert.equal(donated.pricePerPackage, 0);
  assert.equal(donated.packages, draft.packages);
  assert.equal(rules.prepareSale(draft, [calculated], []).sale.donated, false);
});

test("sales cart validates combined packages against existing sales without partial results", () => {
  const calculated = calculations.calculateProduction(production);
  const existing = rules.prepareSale({ ...draft, packages: 1 }, [calculated], []).sale;
  const sales = [existing];
  const drafts = [draft, { ...draft, packages: 3 }];
  const valid = rules.prepareSales(drafts, [calculated], sales);
  assert.equal(valid.error, undefined);
  assert.equal(valid.sales.reduce((sum, sale) => sum + sale.packages, existing.packages), calculated.packages);
  const invalid = rules.prepareSales([draft, { ...draft, packages: 4 }], [calculated], sales);
  assert.match(invalid.error, /Venda 2:.*apenas 3 pacotes/);
  assert.equal(invalid.sales, undefined);
  assert.deepEqual(sales, [existing]);
  assert.deepEqual(drafts, [draft, { ...draft, packages: 3 }]);
});

test("sales cart rejects empty carts, editing and invalid individual fields", () => {
  const calculated = calculations.calculateProduction(production);
  assert.match(rules.prepareSales([], [calculated], []).error, /pelo menos uma venda/);
  assert.match(rules.prepareSales([{ ...draft, id: "existing" }], [calculated], []).error, /novas vendas/);
  for (const patch of [
    { productionId: "missing" }, { packages: 1.5 }, { packages: 0 },
    { pricePerPackage: -1 }, { pricePerPackage: NaN }, { date: "2026-10-15" },
  ]) {
    const result = rules.prepareSales([draft, { ...draft, ...patch }], [calculated], []);
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
  assert.ok(rules.prepareSale(draft, [calculated], []).sale);
  for (const patch of [
    { packages: 7 },
    { packages: 0.5 },
    { pricePerPackage: -1 },
    { date: "2026-10-15" },
    { productionId: "missing" },
  ]) {
    assert.ok(
      rules.prepareSale({ ...draft, ...patch }, [calculated], []).error,
    );
  }
});

test("editing a sale keeps historical cost and excludes its own stock", () => {
  const calculated = calculations.calculateProduction(production);
  const created = rules.prepareSale(draft, [calculated], []).sale;
  const historical = { ...created, id: "sale-test", costPerPackage: 1.25 };
  const edited = rules.prepareSale(
    { ...draft, id: historical.id, packages: 6 },
    [calculated],
    [historical],
  );
  assert.equal(edited.sale.id, historical.id);
  assert.equal(edited.sale.costPerPackage, 1.25);
  assert.equal(edited.sale.productionDate, historical.productionDate);
});

test("lost packages reduce sellable stock and forecast without changing cost per package", () => {
  const calculated = calculations.calculateProduction({ ...production, lostPackages: 2 });
  assert.equal(calculated.packages, 6);
  assert.equal(calculated.costPerPackage, calculations.calculateProduction(production).costPerPackage);
  assert.equal(calculations.remainingPackages(calculated), 4);
  assert.equal(calculations.remainingPackages(calculated, 3), 1);
  assert.equal(calculated.revenue, 10);
  assert.equal(calculated.profit, 0);
  assert.ok(rules.prepareSale({ ...draft, packages: 4 }, [calculated], []).sale);
  assert.match(rules.prepareSale({ ...draft, packages: 5 }, [calculated], []).error, /apenas 4 pacotes/);

  const sale = rules.prepareSale({ ...draft, packages: 3 }, [calculations.calculateProduction(production)], []).sale;
  assert.equal(rules.validateProductionUpdate(production, { lostPackages: 3 }, [sale]), undefined);
  for (const lostPackages of [4, -1, 1.5]) {
    assert.ok(rules.validateProductionUpdate(production, { lostPackages }, [sale]));
  }
});

test("production report summarizes package destinations, yield and financial results", () => {
  const calculated = calculations.calculateProduction({ ...production, lostPackages: 1 });
  const base = { productionId: production.id, productionDate: production.date, recipeName: production.recipeName,
    date: production.date, costPerPackage: calculated.costPerPackage, customer: "", notes: "" };
  const sales = [
    { ...base, id: "paid", packages: 2, pricePerPackage: 3, paid: true },
    { ...base, id: "gift", packages: 1, pricePerPackage: 0, paid: true, donated: true },
    { ...base, id: "pending", packages: 1, pricePerPackage: 4, paid: false },
    { ...base, id: "other", productionId: "other", packages: 5, pricePerPackage: 9, paid: true },
  ];
  const report = productionReport.buildProductionReport(calculated, sales);
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
  assert.equal(productionReport.buildProductionReport(calculated, []).status, "waiting");
  assert.equal(productionReport.buildProductionReport({ ...calculated, lostPackages: 6 }, []).status, "closed");
});

test("production report builds a continuous daily timeline and expiration date", () => {
  const calculated = calculations.calculateProduction(production);
  const base = { productionId: production.id, productionDate: production.date, recipeName: production.recipeName,
    costPerPackage: calculated.costPerPackage, customer: "", notes: "", paid: true };
  const sales = [
    { ...base, id: "a", date: "2026-10-18", packages: 2, pricePerPackage: 3 },
    { ...base, id: "b", date: "2026-10-18", packages: 1, pricePerPackage: 0, donated: true },
    { ...base, id: "c", date: "2026-10-17", packages: 1, pricePerPackage: 4 },
  ];
  const daily = productionReport.buildProductionReport(calculated, sales).daily;
  assert.deepEqual(daily.map((day) => [day.date, day.sold, day.donated, day.total, day.revenue]), [
    ["2026-10-16", 0, 0, 0, 0],
    ["2026-10-17", 1, 0, 1, 4],
    ["2026-10-18", 2, 1, 3, 6],
  ]);
  assert.deepEqual(daily.map((day) => day.result), [-calculated.cost, 4 - calculated.cost, 10 - calculated.cost]);
  assert.deepEqual(productionReport.buildProductionReport(calculated, []).daily, []);
  const longGap = productionReport.buildDailyTimeline(calculated, [{ ...sales[0], date: "2027-03-01" }]);
  assert.deepEqual(longGap.map((day) => day.date), ["2026-10-16", "2027-03-01"]);
  assert.equal(productionReport.expirationDate("2026-10-16", 20), "2026-11-05");
  assert.equal(productionReport.expirationDate("2026-10-16", 0), "2026-10-16");
  assert.equal(productionReport.expirationDate("2026-10-16", null), null);
});

test("production changes cannot invalidate existing sales", () => {
  const calculated = calculations.calculateProduction(production);
  const sale = rules.prepareSale(draft, [calculated], []).sale;
  for (const patch of [
    { packageQty: 2 },
    { recipeId: "other" },
    { actualYield: 3 },
    { date: "2026-10-17" },
  ]) {
    assert.ok(rules.validateProductionUpdate(production, patch, [sale]));
  }
  assert.equal(
    rules.validateProductionUpdate(production, { margin: 80 }, [sale]),
    undefined,
  );
});

test("financial summaries and periods retain their results", () => {
  assert.equal(overview.balance(0.1 + 0.2, 0.3), 0);
  assert.equal(
    overview.periodStart("week", new Date(2026, 9, 16)),
    "2026-10-10",
  );
  assert.equal(overview.periodStart("all", new Date(2026, 9, 16)), "");
  const sale = {
    ...rules.prepareSale(
      draft,
      [calculations.calculateProduction(production)],
      [],
    ).sale,
    costPerPackage: 1.25,
  };
  assert.deepEqual(overview.summarizeSales([sale]), {
    packages: 2,
    revenue: 6,
    received: 6,
    pending: 0,
    cost: 2.5,
  });
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
