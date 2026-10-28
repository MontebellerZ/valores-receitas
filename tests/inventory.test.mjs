import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import XLSX from "xlsx";

let server, calculations, rules, workbookService, paths, workspaceService, api;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false }, logLevel: "silent" });
  calculations = await server.ssrLoadModule("/src/domain/calculations.ts");
  rules = await server.ssrLoadModule("/src/domain/workspaceRules.ts");
  workbookService = await server.ssrLoadModule("/src/services/workbook.ts");
  ({ paths } = await server.ssrLoadModule("/src/app/paths.ts"));
  ({ workspaceService } = await server.ssrLoadModule("/src/services/workspace.ts"));
  ({ api } = await server.ssrLoadModule("/src/services/http.ts"));
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
  assert.match(rules.prepareSale({ productionId: draft.id }, [draft], []).error, /Salve a produção/);
});

test("a saved production cannot change its recipe or consumed quantity even without sales", () => {
  assert.match(rules.validateProductionUpdate(production, { quantity: 4 }, []), /imutáveis/);
  assert.match(rules.validateProductionUpdate(production, { recipeId: "other" }, []), /imutáveis/);
  assert.equal(rules.validateProductionUpdate(production, { margin: 25 }, []), undefined);
  assert.equal(rules.validateProductionUpdate({ ...production, quantity: 0 }, { quantity: 1 }, []), undefined);
});

test("inventory and input catalogs have distinct routes", () => {
  assert.equal(paths.market, "/insumos");
  assert.equal(paths.stock, "/estoque");
});

test("server snapshots normalize nullable sale prices and retain authoritative production totals", async () => {
  const originalAdapter = api.defaults.adapter;
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return {
      data: { market: [], recipes: [], sales: [], revision: 4, productions: [{ ...production, expectedSalePrice: null }] },
      status: 200, statusText: "OK", headers: {}, config,
    };
  };
  try {
    const loaded = await workspaceService.load();
    assert.equal(loaded.productions[0].expectedSalePrice, undefined);
    assert.equal(loaded.productions[0].totalCost, 1);
    const saved = await workspaceService.save(loaded);
    assert.equal(saved.revision, 4);
    assert.equal(saved.productions[0].expectedSalePrice, undefined);
    assert.equal(JSON.parse(requests[1].data).revision, 4);
  } finally {
    api.defaults.adapter = originalAdapter;
  }
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

test("stock entry requests include each purchase's package quantity and price", async () => {
  const originalAdapter = api.defaults.adapter;
  const requests = [];
  api.defaults.adapter = async (config) => {
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

test("stock reads include exhausted packages and corrections send only opted-in fields with revision", async () => {
  const originalAdapter = api.defaults.adapter;
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return { data: [], status: 200, statusText: "OK", headers: {}, config };
  };
  try {
    const controller = new AbortController();
    await workspaceService.stock(controller.signal);
    assert.equal(requests[0].params.includeInactive, true);
    assert.equal(requests[0].signal, controller.signal);
    await workspaceService.updateStock({ lotIds: ["one", "two"], packagePrice: 0, reason: "Preço incorreto" }, 8);
    assert.equal(requests[1].method, "put");
    assert.equal(requests[1].url, "/stock");
    assert.deepEqual(JSON.parse(requests[1].data), {
      lotIds: ["one", "two"], packagePrice: 0, reason: "Preço incorreto", revision: 8,
    });

  } finally {
    api.defaults.adapter = originalAdapter;
  }
});

test("stock deletion encodes the package id and sends the current revision", async () => {
  const originalAdapter = api.defaults.adapter;
  let request;
  api.defaults.adapter = async (config) => {
    request = config;
    return { data: undefined, status: 204, statusText: "No Content", headers: {}, config };
  };
  try {
    assert.deepEqual(await workspaceService.deleteStock("lot /?#", 9), { revision: 10 });
    assert.equal(request.method, "delete");
    assert.equal(request.url, "/stock/lot%20%2F%3F%23");
    assert.deepEqual(request.params, { revision: 9 });
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});