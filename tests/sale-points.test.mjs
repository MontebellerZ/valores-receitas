import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { fileURLToPath } from "node:url";

let server;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false }, logLevel: "silent" });
});
after(async () => { await server?.close(); });
const load = (path) => server.ssrLoadModule(`/src/${path}`);
const noop = () => {};
const ready = (data) => ({ status: "ready", data });
const inventory = [
  { productionId: "p1", recipeName: "Brownie avulso", date: "2026-10-22", salePointId: null, salePointName: "Sem ponto", packages: 3 },
  { productionId: "p1", recipeName: "Brownie avulso", date: "2026-10-22", salePointId: "a", salePointName: "Feira", packages: 5 },
];
const points = [
  { id: "a", name: "Feira", availablePackages: 5, soldPackages: 2, donatedPackages: 1, revenue: 20, cost: 6 },
  { id: null, name: "Sem ponto", availablePackages: 3, soldPackages: 0, donatedPackages: 0, revenue: 0, cost: 0 },
];
const balance = { id: "p1", recipeId: null, recipeName: "Brownie avulso", date: "2026-10-22",
  quantity: 1, packages: 10, soldPackages: 2, availablePackages: 8, lostPackages: 0, salePrice: 10 };
const sale = { id: "s1", productionId: "p1", productionDate: balance.date, recipeName: balance.recipeName,
  date: balance.date, packages: 2, pricePerPackage: 10, costPerPackage: 2, customer: "", paid: true, notes: "",
  salePointId: "a", salePointName: "Feira" };
const render = (Component, props) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Component, props)));

test("location stock never borrows from another point and returns an edited sale only to its original location", async () => {
  const { locationAvailable } = await load("domain/salePoints.ts");
  assert.equal(locationAvailable(inventory, "p1", null), 3);
  assert.equal(locationAvailable(inventory, "p1", "a"), 5);
  assert.equal(locationAvailable(inventory, "p1", "b"), 0);
  assert.equal(locationAvailable(inventory, "p1", "a", sale), 7);
  assert.equal(locationAvailable(inventory, "p1", null, sale), 3);
  assert.equal(locationAvailable(inventory, "other", "a", sale), 0);
  const reservations = [{ productionId: "p1", salePointId: "a", packages: 4 },
    { productionId: "p1", salePointId: null, packages: 1 }];
  assert.equal(locationAvailable(inventory, "p1", "a", undefined, reservations), 1);
  assert.equal(locationAvailable(inventory, "p1", null, undefined, reservations), 2);
  assert.equal(locationAvailable([], "p1", "a", sale), 2);
});

test("remaining allocation permits full transfers and release to Sem ponto but rejects invalid totals", async () => {
  const { validateAllocations } = await load("domain/salePoints.ts");
  assert.equal(validateAllocations([{ salePointId: "a", packages: 8 }], 8), undefined);
  assert.equal(validateAllocations([{ salePointId: "a", packages: 0 }], 8), undefined);
  assert.equal(validateAllocations([], 8), undefined);
  for (const allocations of [
    [{ salePointId: "a", packages: 9 }], [{ salePointId: "a", packages: -1 }],
    [{ salePointId: "a", packages: .5 }], [{ salePointId: "a", packages: NaN }],
    [{ salePointId: "", packages: 1 }],
    [{ salePointId: "a", packages: 1 }, { salePointId: "a", packages: 1 }],
  ]) assert.equal(typeof validateAllocations(allocations, 8), "string");
});

test("direct-sale reclassification requires unchanged production and quantity and preserves stock origin", async () => {
  const { canReclassifySale, locationAvailable } = await load("domain/salePoints.ts");
  const direct = { ...sale, salePointId: null };
  const reclassified = { ...sale, usesUnassignedStock: true };
  for (const existing of [direct, reclassified]) {
    assert.equal(canReclassifySale(existing, "p1", 2), true);
    assert.equal(canReclassifySale(existing, "p1", 3), false);
    assert.equal(canReclassifySale(existing, "other", 2), false);
  }
  assert.equal(canReclassifySale(sale, "p1", 2), false);
  assert.equal(canReclassifySale(undefined, "p1", 2), false);
  assert.equal(locationAvailable(inventory, "p1", "a", reclassified), 5);
  assert.equal(locationAvailable(inventory, "p1", null, reclassified), 5);
});

test("stock cards group recipe totals across production dates and transfers preserve other locations", async () => {
  const { groupInventoryByRecipe, transferAllocations } = await load("domain/salePoints.ts");
  const rows = [
    ...inventory,
    { ...inventory[1], productionId: "p2", date: "2026-10-25", packages: 2 },
    { ...inventory[1], productionId: "p3", recipeName: "Bolo", date: "2026-10-26", packages: 4 },
    { ...inventory[1], productionId: "p1", salePointId: "b", salePointName: "Loja", packages: 1 },
  ];
  assert.deepEqual(groupInventoryByRecipe(rows, "a"), [
    { recipeName: "Bolo", packages: 4 }, { recipeName: "Brownie avulso", packages: 7 },
  ]);
  assert.deepEqual(groupInventoryByRecipe(rows, null), [{ recipeName: "Brownie avulso", packages: 3 }]);
  assert.deepEqual(transferAllocations(rows, "p1", "a", "b", 2, ["a", "b"]), [
    { salePointId: "a", packages: 3 }, { salePointId: "b", packages: 3 },
  ]);
  assert.deepEqual(transferAllocations(rows, "p1", "a", null, 5, ["a", "b"]), [
    { salePointId: "a", packages: 0 }, { salePointId: "b", packages: 1 },
  ]);
  assert.deepEqual(transferAllocations(rows, "p1", null, "b", 2, ["a", "b"]), [
    { salePointId: "a", packages: 5 }, { salePointId: "b", packages: 3 },
  ]);
  assert.equal(transferAllocations(rows, "p1", "a", "b", 6, ["a", "b"]), null);
  assert.equal(transferAllocations(rows, "p1", "a", "missing", 1, ["a", "b"]), null);
});

test("sale preparation retains the optional location for both a cart and a single edit", async () => {
  const { prepareSale, prepareSales } = await load("domain/workspaceRules.ts");
  const production = { ...balance, costPerPackage: 2 };
  const { id, ...draft } = sale;
  void id;
  assert.equal(prepareSale(draft, production, 2).sale.salePointId, "a");
  assert.equal(prepareSale({ ...sale, salePointId: null }, production, 0, sale).sale.salePointId, null);
  const result = prepareSales([draft, { ...draft, salePointId: null }], [{ production, soldPackages: 2 }]);
  assert.deepEqual(result.sales.map((row) => row.salePointId), ["a", null]);
});

test("sale-point response adapters reject missing Sem ponto and malformed stock instead of fabricating zeros", async () => {
  const { toSalePoints, toSalePointInventory } = await load("services/salePoints.ts");
  assert.deepEqual(toSalePoints(points), points);
  assert.deepEqual(toSalePointInventory(inventory), inventory);
  assert.deepEqual(toSalePointInventory([]), []);
  for (const value of [null, {}, [], [points[0]], [{ ...points[1], revenue: "0" }]])
    assert.throws(() => toSalePoints(value), /Resposta inesperada/);
  for (const value of [null, {}, [{ ...inventory[0], packages: 0 }], [{ ...inventory[0], packages: .5 }],
    [{ ...inventory[0], salePointId: undefined }]])
    assert.throws(() => toSalePointInventory(value), /Resposta inesperada/);
});

test("sale-point services send workspace revisions and remaining allocations using the agreed HTTP contract", async () => {
  const { salePointsService } = await load("services/salePoints.ts");
  const { api } = await load("services/http.ts");
  const { queryService } = await load("services/query.ts");
  const adapter = api.defaults.adapter;
  const summary = queryService.summary;
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    const data = config.method === "get"
      ? config.url.endsWith("/inventory") ? inventory : points
      : config.method === "delete" ? "" : { id: "a", name: "Feira", revision: 8 };
    return { config, data, status: config.method === "delete" ? 204 : 200, statusText: "OK", headers: {} };
  };
  queryService.summary = async () => ({ revision: 9 });
  try {
    await salePointsService.list({ from: "2026-10-01", to: "2026-10-22" });
    await salePointsService.inventory("p1");
    await salePointsService.save({ name: " Feira " }, 7);
    await salePointsService.save({ id: "a", name: " Feira nova " }, 8);
    await salePointsService.allocate("p1", [{ salePointId: "a", packages: 4 }], 8);
    assert.deepEqual(await salePointsService.remove("a", 8), { revision: 9 });
    assert.deepEqual(requests.map((request) => [request.method, request.url]), [
      ["get", "/sale-points"], ["get", "/sale-points/inventory"], ["post", "/sale-points"],
      ["put", "/sale-points/a"], ["put", "/sale-points/allocations/p1"], ["delete", "/sale-points/a"],
    ]);
    assert.deepEqual(requests[0].params, { from: "2026-10-01", to: "2026-10-22" });
    assert.deepEqual(requests[1].params, { productionId: "p1" });
    assert.deepEqual(JSON.parse(requests[2].data), { name: "Feira", revision: 7 });
    assert.deepEqual(JSON.parse(requests[4].data), { revision: 8, allocations: [{ salePointId: "a", packages: 4 }] });
    assert.deepEqual(requests[5].params, { revision: 8 });
    const { workspaceService } = await load("services/workspace.ts");
    await workspaceService.patchSales({ changed: [{ ...sale, usesUnassignedStock: true }], deleted: [], revision: 9 });
    const patch = JSON.parse(requests[6].data);
    assert.equal(patch.changed[0].salePointId, "a");
    assert.equal("salePointName" in patch.changed[0], false);
    assert.equal("usesUnassignedStock" in patch.changed[0], false);
  } finally { api.defaults.adapter = adapter; queryService.summary = summary; }
});

test("sale-point page groups standalone stock including Sem ponto and exposes CRUD, transfer and period comparisons", async () => {
  const { default: Page } = await load("pages/sale-points/SalePointsPage/index.tsx");
  const props = { points: ready(points), inventory: ready(inventory), range: { from: "", to: "2026-10-22" },
    onRangeChange: noop, canManage: true, onSave: noop, onDelete: noop, onAllocate: noop };
  const html = render(Page, props);
  for (const label of ["Pontos de venda", "Cadastrar ponto", "Comparação de vendas", "Faturamento", "Doados",
    "Estoque por ponto", "Sem ponto", "Feira", "Brownie avulso", "Ver estoque de Feira", "Ver estoque de Sem ponto",
    'aria-label="Editar ponto Feira"', 'aria-label="Excluir ponto Feira"']) assert.ok(html.includes(label), label);
  assert.match(html, /point-card/);
  const source = await readFile(new URL("../src/pages/sale-points/SalePointsPage/index.tsx", import.meta.url), "utf8");
  assert.match(source, /<SearchableSelect/);
  assert.match(source, /Quantidade de pacotes/);
  const empty = render(Page, { ...props, inventory: ready([]), points: ready([points[1]]) });
  assert.match(empty, /Vendas diretas continuam disponíveis em Sem ponto/);
  assert.doesNotMatch(empty, /Excluir ponto Sem ponto/);
  const failed = render(Page, { ...props, points: { status: "error" }, inventory: { status: "error" } });
  assert.match(failed, /role="alert"/);
  assert.doesNotMatch(failed, /Nenhum pacote disponível/);
});

test("sale form defaults direct sales to Sem ponto, constrains each location, releases edited stock and blocks unloaded data", async () => {
  const { default: Form } = await load("components/sales/SaleForm/index.tsx");
  const props = { initialBalance: balance, totalAvailable: 8, inventory: ready(inventory), points: ready(points),
    onSave: noop, onSaveSales: noop, onCancel: noop };
  const direct = render(Form, props);
  assert.match(direct, /Ponto de venda \(opcional\)/);
  assert.match(direct, /max="3"/);
  assert.match(direct, /Sem ponto/);
  const edit = render(Form, { ...props, sale });
  assert.match(edit, /max="7"/);
  assert.match(edit, /Feira/);
  const exhausted = render(Form, { ...props, inventory: ready(inventory.filter((row) => row.salePointId !== null)) });
  assert.match(exhausted, /max="0"/);
  const failed = render(Form, { ...props, inventory: { status: "error" } });
  assert.match(failed, /Não foi possível carregar a disponibilidade por ponto/);
  assert.match(failed, /<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>[\s\S]*?Confirmar vendas/);
});

test("editing fully sold direct or reclassified sales does not require destination stock", async () => {
  const { default: Form } = await load("components/sales/SaleForm/index.tsx");
  const props = { initialBalance: { ...balance, soldPackages: 10, availablePackages: 0 },
    totalAvailable: 10, inventory: ready([]), points: ready(points), onSave: noop, onSaveSales: noop, onCancel: noop };
  for (const existing of [
    { ...sale, packages: 10, salePointId: null },
    { ...sale, packages: 10, usesUnassignedStock: true },
  ]) {
    const html = render(Form, { ...props, sale: existing });
    assert.match(html, /max="10"/);
    assert.doesNotMatch(html, /reclassificar venda/);
    assert.match(html, /sem alterar o estoque/);
  }
  const ordinary = render(Form, { ...props, sale: { ...sale, packages: 10 } });
  assert.doesNotMatch(ordinary, /reclassificar venda/);
});
