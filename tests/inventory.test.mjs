import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import XLSX from "xlsx";

let server, calculations, rules, workbookService, paths, workspaceService, api, queryService, toSummary;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false }, logLevel: "silent" });
  calculations = await server.ssrLoadModule("/src/domain/calculations.ts");
  rules = await server.ssrLoadModule("/src/domain/workspaceRules.ts");
  workbookService = await server.ssrLoadModule("/src/services/workbook.ts");
  ({ paths } = await server.ssrLoadModule("/src/app/paths.ts"));
  ({ workspaceService } = await server.ssrLoadModule("/src/services/workspace.ts"));
  ({ api } = await server.ssrLoadModule("/src/services/http.ts"));
  ({ queryService, toSummary } = await server.ssrLoadModule("/src/services/query.ts"));
});
after(async () => { await server?.close(); });

const production = {
  id: "production", date: "2026-10-17", recipeId: "recipe", recipeName: "Pão",
  quantity: 3, actualYield: 30, losses: 0, margin: 50, packageQty: 1,
  yieldPerBatch: 10, ingredientCostPerBatch: 0.33333333, totalCost: 1,
};

test("production calculations use authoritative FIFO total rather than rounded per-batch cost", () => {
  const result = calculations.calculateProduction(production);
  assert.equal(result.cost, 1);
  assert.equal(result.costPerPackage, 1 / 30);
  assert.equal(calculations.calculateProduction({ ...production, totalCost: 0 }).cost, 0);
  assert.equal(calculations.calculateProduction({ ...production, totalCost: null, ingredientCostPerBatch: 5 }).cost, 15);
});

test("drafts have no sellable packages and cannot create sales before stock consumption", () => {
  const draft = calculations.calculateProduction({ ...production, quantity: 0, totalCost: null });
  assert.equal(draft.packages, 0);
  assert.equal(draft.produced, 0);
  assert.match(rules.prepareSale({ productionId: draft.id }, draft, 0).error, /Salve a produção/);
});

test("a saved production cannot change its recipe or consumed quantity even without sales", () => {
  const none = { salesCount: 0, soldPackages: 0, firstSaleDate: null };
  assert.match(rules.validateProductionUpdate(production, { quantity: 4 }, none), /imutáveis/);
  assert.match(rules.validateProductionUpdate(production, { recipeId: "other" }, none), /imutáveis/);
  assert.equal(rules.validateProductionUpdate(production, { margin: 25 }, none), undefined);
  assert.equal(rules.validateProductionUpdate({ ...production, quantity: 0 }, { quantity: 1 }, none), undefined);
});

test("inventory and input catalogs have distinct routes", () => {
  assert.equal(paths.market, "/insumos");
  assert.equal(paths.stock, "/estoque");
});

const withAdapter = async (respond, run) => {
  const originalAdapter = api.defaults.adapter;
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return { status: 200, statusText: "OK", headers: {}, config, ...respond(config, requests.length) };
  };
  try {
    await run(requests);
  } finally {
    api.defaults.adapter = originalAdapter;
  }
};

test("explicit bulk snapshots normalize nullable sale prices and retain authoritative production totals", async () => {
  await withAdapter(() => ({
    data: { market: [], recipes: [], sales: [], revision: 4, productions: [{ ...production, expectedSalePrice: null }] },
  }), async (requests) => {
    const loaded = await workspaceService.load();
    assert.equal(loaded.productions[0].expectedSalePrice, undefined);
    assert.equal(loaded.productions[0].totalCost, 1);
    const saved = await workspaceService.save(loaded);
    assert.equal(saved.revision, 4);
    assert.equal(JSON.parse(requests[1].data).revision, 4);
  });
});

test("incremental saves PATCH only changed records and deleted ids and require the new revision", async () => {
  const changes = {
    market: [], recipes: [], productions: [{ ...production }], sales: [],
    deleted: { market: ["old"], recipes: [], productions: [], sales: ["sale"] }, revision: 7,
  };
  await withAdapter(() => ({ data: { productions: [{ ...production, expectedSalePrice: null }], revision: 8 } }), async (requests) => {
    const saved = await workspaceService.patch(changes);
    assert.equal(requests[0].method, "patch");
    assert.equal(requests[0].url, "/data");
    assert.deepEqual(JSON.parse(requests[0].data), changes);
    assert.equal(saved.revision, 8);
    assert.deepEqual([saved.market, saved.recipes, saved.sales], [[], [], []]);
    assert.equal(saved.productions[0].expectedSalePrice, undefined);
  });
  await withAdapter(() => ({ data: {} }), async () => {
    await assert.rejects(workspaceService.patch(changes), /revisão/);
  });
});

test("paged queries validate page sizes and the page envelope without silent fallbacks", async () => {
  await withAdapter(() => ({ data: { items: [{ id: "a", name: "A", unit: "g", ingredientCount: 3 }], page: 2, pageSize: 25, totalCount: 26, totalPages: 2 } }),
    async (requests) => {
      const page = await queryService.market({ page: 2, pageSize: 25, search: "  ", sortBy: "name", descending: false });
      assert.equal(requests[0].url, "/query/market");
      assert.deepEqual(requests[0].params, { page: 2, pageSize: 25, sortBy: "name", descending: false });
      assert.equal(page.items[0].ingredientCount, 3);
      assert.equal(page.totalCount, 26);
    });
  await assert.rejects(queryService.market({ page: 1, pageSize: 20 }), /Tamanho de página/);
  await withAdapter(() => ({ data: [] }), async () => {
    await assert.rejects(queryService.sales({ page: 1, pageSize: 10 }), /Resposta inesperada/);
  });
});

test("id lookups request a single page of up to 100 records and refuse larger batches", async () => {
  await withAdapter(() => ({ data: { items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 } }), async (requests) => {
    await queryService.recipesByIds(["a", "b", "a", ""]);
    assert.deepEqual(requests[0].params, { page: 1, pageSize: 100, ids: "a,b" });
    assert.deepEqual(await queryService.marketByIds([]), []);
    assert.equal(requests.length, 1);
  });
  await assert.rejects(queryService.marketByIds(Array.from({ length: 101 }, (_, index) => `id${index}`)), /no máximo 100/);
});

test("detail lookups return null only for missing records", async () => {
  const fail = (status) => (config) => {
    const error = new Error(`HTTP ${status}`);
    error.isAxiosError = true;
    error.response = { status, data: {}, headers: {}, config };
    throw error;
  };
  const originalAdapter = api.defaults.adapter;
  try {
    api.defaults.adapter = async (config) => fail(404)(config);
    assert.equal(await queryService.sale("missing"), null);
    api.defaults.adapter = async (config) => fail(500)(config);
    await assert.rejects(queryService.sale("broken"), /500/);
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});

test("balances and summaries require the server aggregates", async () => {
  const balance = { production, soldPackages: 4, packages: 30, availablePackages: 26,
    periodSales: { count: 1, packages: 4, revenue: 8, cost: 1 } };
  await withAdapter(() => ({ data: { items: [balance], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } }), async (requests) => {
    const page = await queryService.balances({ page: 1, pageSize: 10, available: true });
    assert.equal(requests[0].url, "/query/balances");
    assert.equal(requests[0].params.available, true);
    assert.deepEqual([page.items[0].id, page.items[0].soldPackages, page.items[0].availablePackages], [production.id, 4, 26]);
  });
  await withAdapter(() => ({ data: { items: [{ production }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } }), async () => {
    await assert.rejects(queryService.balances({ page: 1, pageSize: 10 }), /Resposta inesperada/);
  });
  assert.throws(() => toSummary({ revision: 1, counts: { market: 1 } }), /Resposta inesperada/);
});

test("production reports and sales require the server accumulated revenue", async () => {
  const totals = { salesCount: 1, outPackages: 2, donatedPackages: 0, revenue: 6, received: 6, pending: 0, soldCost: 1,
    firstSaleDate: "2026-10-20", topBuyers: [{ customer: "Ana", packages: 2, spent: 6 }] };
  const day = { date: "2026-10-20T00:00:00", sold: 2, donated: 0, total: 2, revenue: 6, cumulativeRevenue: 16 };
  const page = (items) => ({ items, page: 2, pageSize: 10, totalCount: 11, totalPages: 2 });
  await withAdapter(() => ({ data: { ...totals, daily: page([day]) } }), async (requests) => {
    const report = await queryService.report("bread", { page: 2, pageSize: 10 });
    assert.equal(requests[0].url, "/query/productions/bread/report");
    assert.deepEqual(report.daily.items, [{ ...day, date: "2026-10-20" }]);
    assert.deepEqual(report.topBuyers, totals.topBuyers);
  });
  for (const topBuyers of [undefined, null, {}, [{ customer: null, packages: 2, spent: 6 }],
    [{ customer: "Ana", packages: "2", spent: 6 }], [{ customer: "Ana", packages: 2 }],
    Array.from({ length: 6 }, () => totals.topBuyers[0])]) {
    await withAdapter(() => ({ data: { ...totals, topBuyers, daily: page([day]) } }), async () => {
      await assert.rejects(queryService.report("bread", { page: 1, pageSize: 10 }), /Resposta inesperada/);
    });
  }
  await withAdapter(() => ({ data: { ...totals, topBuyers: [], daily: page([]) } }), async () => {
    assert.deepEqual((await queryService.report("bread", { page: 1, pageSize: 10 })).topBuyers, []);
  });
  await withAdapter(() => ({ data: { ...totals, daily: page([{ ...day, cumulativeRevenue: undefined }]) } }), async () => {
    await assert.rejects(queryService.report("bread", { page: 2, pageSize: 10 }), /Resposta inesperada/);
  });
  const sale = { id: "sale", productionId: "bread", date: "2026-10-20", packages: 2, pricePerPackage: 3, cumulativeRevenue: 16 };
  await withAdapter(() => ({ data: page([sale]) }), async (requests) => {
    const sales = await queryService.productionSales("bread", { page: 2, pageSize: 10, sortBy: "total", descending: true });
    assert.equal(requests[0].url, "/query/sales");
    assert.deepEqual(requests[0].params, { page: 2, pageSize: 10, sortBy: "total", descending: true, productionId: "bread" });
    assert.equal(sales.items[0].cumulativeRevenue, 16);
  });
  await withAdapter(() => ({ data: page([{ ...sale, cumulativeRevenue: null }]) }), async () => {
    await assert.rejects(queryService.productionSales("bread", { page: 1, pageSize: 10 }), /Resposta inesperada/);
  });
});

test("input workbook imports name and unit without purchase data and links recipe ingredients", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Item: "Farinha", Unidade: "g", "Qtd pacote": 1000 }]), "Insumos");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Receita: "Pão", Rendimento: 10, Item: "Farinha", "Quantidade usada": 500 }]), "Receitas");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const result = await workbookService.importWorkbook({ arrayBuffer: async () => buffer });
  assert.equal(result.market.length, 1);
  assert.equal(result.market[0].name, "Farinha");
  assert.equal(result.market[0].unit, "g");
  assert.equal("packageQty" in result.market[0], false);
  assert.equal("packagePrice" in result.market[0], false);
  assert.equal(result.recipes[0].ingredients[0].marketItemId, result.market[0].id);
  assert.equal(result.recipes[0].ingredients[0].quantity, 500);
});

test("stock entry requests include each purchase's package quantity and price in compact mode", async () => {
  const originalAdapter = api.defaults.adapter;
  const requests = [];
  api.defaults.adapter = async (config) => {
    assert.deepEqual(config.params, { compact: true });
    requests.push(JSON.parse(config.data));
    return { data: {}, status: 201, statusText: "Created", headers: {}, config };
  };
  try {
    const entry = { marketItemId: "butter", entryDate: "2026-10-19", packageQty: 200, packagePrice: 8 };
    await workspaceService.addStock(entry, 1);
    await workspaceService.addStock({ ...entry, packageQty: 500, packagePrice: 15 }, 2);
    await workspaceService.addStock({ ...entry, packageCount: 4, packagePrice: 7.98 }, 3);
    assert.deepEqual(requests, [
      { ...entry, revision: 1 },
      { ...entry, packageQty: 500, packagePrice: 15, revision: 2 },
      { ...entry, packageCount: 4, packagePrice: 7.98, revision: 3 },
    ]);
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});

test("name-and-unit-only workbooks import without a package size", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Item: "Manteiga BH", Unidade: "g" }]), "Insumos");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const result = await workbookService.importWorkbook({ arrayBuffer: async () => buffer });
  assert.deepEqual(Object.keys(result.market[0]).sort(), ["id", "name", "unit"]);
  assert.equal(result.market[0].name, "Manteiga BH");
});

test("stock pages include exhausted packages and corrections send only opted-in fields with revision", async () => {
  await withAdapter(() => ({ data: { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 } }), async (requests) => {
    const controller = new AbortController();
    await queryService.stock({ page: 1, pageSize: 10, includeInactive: true, sortBy: "entryOrder", descending: true }, controller.signal);
    assert.equal(requests[0].url, "/query/stock");
    assert.equal(requests[0].params.includeInactive, true);
    assert.equal(requests[0].signal, controller.signal);
    await workspaceService.updateStock({ lotIds: ["one", "two"], packagePrice: 0, reason: "Preço incorreto" }, 8);
    assert.equal(requests[1].method, "put");
    assert.equal(requests[1].url, "/stock");
    assert.deepEqual(requests[1].params, { compact: true });
    assert.deepEqual(JSON.parse(requests[1].data), {
      lotIds: ["one", "two"], packagePrice: 0, reason: "Preço incorreto", revision: 8,
    });
  });
});

test("stock deletion encodes the package id, sends the current revision and returns the server revision", async () => {
  await withAdapter(() => ({ data: { revision: 10 } }), async (requests) => {
    assert.deepEqual(await workspaceService.deleteStock("lot /?#", 9), { revision: 10 });
    assert.equal(requests[0].method, "delete");
    assert.equal(requests[0].url, "/stock/lot%20%2F%3F%23");
    assert.deepEqual(requests[0].params, { revision: 9 });
  });
  await withAdapter(() => ({ data: undefined, status: 204 }), async () => {
    await assert.rejects(workspaceService.deleteStock("lot", 9), /revisão/);
  });
});

test("recipe edits across ingredient pages coalesce into one partial recipe patch", async () => {
  const edits = await server.ssrLoadModule("/src/domain/recipeEdits.ts");
  const saved = { id: "r1", name: "Pão", category: "", yield: 10, hoursPerBatch: 1, ingredients: [], ingredientCount: 32 };
  const page1 = [{ id: "i1", marketItemId: "m1", quantity: 1 }, { id: "i2", marketItemId: "m2", quantity: 2 }];
  const page2 = [{ id: "i11", marketItemId: "m11", quantity: 10 }];
  let drafts = {};
  const change = (fn) => {
    const edit = fn(edits.startEdit(drafts, saved));
    drafts = { ...drafts, [edit.recipe.id]: edit };
  };
  change((edit) => edits.upsertIngredient(edit, page1[0], { quantity: 7 }));
  change((edit) => edits.upsertIngredient(edit, page2[0], { quantity: 21 }));
  change((edit) => edits.upsertIngredient(edit, page1[0], { quantity: 8 }));
  change((edit) => edits.editRecipe(edit, { name: "Pão integral" }));
  change((edit) => edits.addIngredient(edit, "new"));
  change((edit) => edits.removeIngredient(edit, "new"));
  change((edit) => edits.removeIngredient(edit, "i2"));
  assert.deepEqual(Object.keys(drafts), ["r1"]);
  const body = edits.recipePatch(Object.values(drafts));
  assert.equal(body.recipes.length, 1);
  assert.equal(body.recipes[0].name, "Pão integral");
  assert.equal("ingredientCount" in body.recipes[0], false);
  assert.deepEqual(body.recipes[0].ingredients, [{ id: "i11", marketItemId: "m11", quantity: 21 }, { id: "i1", marketItemId: "m1", quantity: 8 }]);
  assert.equal(body.partialRecipeIngredients, true);
  assert.deepEqual(body.deletedIngredients, ["i2"]);
  assert.deepEqual(edits.editedIngredients(drafts, "r1", page1), [{ id: "i1", marketItemId: "m1", quantity: 8 }]);
  assert.equal(edits.editedRecipe(drafts, saved).ingredientCount, 31);
  // Whole recipes (registration, import) keep full replacement and never send the partial fields.
  assert.deepEqual(edits.recipePatch([], [saved]), { recipes: [saved] });
  assert.throws(() => edits.recipePatch(Object.values(drafts), [saved]), /Salve ou descarte/);
  assert.throws(() => edits.recipePatch([drafts.r1, drafts.r1]), /duplicidade/);
});

test("recipe metadata requires the ingredient count and ingredients are paged on the server", async () => {
  await withAdapter((config) => ({ data: config.url.endsWith("/metadata")
    ? { id: "r1", name: "Pão", category: "", yield: 1, hoursPerBatch: 0, ingredients: [], ingredientCount: 32 }
    : { items: [{ id: "i1", marketItemId: "m1", quantity: 1 }], page: 2, pageSize: 10, totalCount: 32, totalPages: 4 } }),
  async (requests) => {
    assert.equal((await queryService.recipeMetadata("r1")).ingredientCount, 32);
    assert.equal(requests[0].url, "/query/recipes/r1/metadata");
    const page = await queryService.recipeIngredients("r1", { page: 2, pageSize: 10, sortBy: "quantity", descending: true, search: "fa" });
    assert.equal(requests[1].url, "/query/recipes/r1/ingredients");
    assert.deepEqual(requests[1].params, { page: 2, pageSize: 10, sortBy: "quantity", descending: true, search: "fa" });
    assert.equal(page.totalCount, 32);
  });
  await withAdapter(() => ({ data: { id: "r1", name: "Pão", ingredients: [] } }), async () => {
    await assert.rejects(queryService.recipeMetadata("r1"));
  });
});
