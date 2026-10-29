import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import * as sass from "sass";
import path from "node:path";
import { readFile } from "node:fs/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
let server;
before(async () => {
  server = await createServer({ root, server: { middlewareMode: true, hmr: false }, logLevel: "silent" });
});
after(async () => { await server?.close(); });
const load = (name) => server.ssrLoadModule(`/src/components/${name}/index.tsx`);
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
const children = (element) => [element?.props?.children].flat(Infinity).filter(Boolean);
/** Calls a hook-based component inside a real render so its returned element tree can be inspected. */
function capture(Component, props) {
  let tree;
  renderToStaticMarkup(createElement(function Capture() {
    tree = Component(props);
    return tree;
  }));
  return tree;
}
function descendants(element) {
  return [element, ...children(element).flatMap(descendants)];
}

const recipes = [
  { id: "a", name: "Cookies", category: "Doces", yield: 30, hoursPerBatch: 2, ingredients: [] },
  { id: "b", name: "Bolo", category: "Bolos", yield: 12, hoursPerBatch: 1, ingredients: [] },
];
const production = {
  date: "2026-10-19", recipeId: "a", recipeName: "Cookies", quantity: 2,
  actualYield: 60, losses: 1, packageQty: 2, margin: 50, yieldPerBatch: 30, ingredientCostPerBatch: 0,
};

test("stock registration and correction share fields, constraints and opt-in edits", async () => {
  const { default: Fields } = await load("stock/StockEntryFields");
  const market = [{ id: "flour", name: "Farinha", unit: "g" }];
  const value = { marketItemId: "flour", entryDate: "2026-10-17", packageQty: 1000, packagePrice: 10 };
  const enabledFields = { marketItemId: false, entryDate: false, packageQty: false, packagePrice: true };
  const changes = [], toggles = [];
  const props = { market, value, enabledFields, onChange: (patch) => changes.push(patch), onToggleField: (...args) => toggles.push(args) };
  const nodes = descendants(Fields(props));
  const price = nodes.find((node) => node?.props?.step === "0.01");
  assert.equal(price.props.disabled, false);
  price.props.onChange({ target: { value: "0" } });
  assert.deepEqual(changes.pop(), { packagePrice: 0 });
  const quantity = nodes.find((node) => node?.props?.step === "0.0001");
  assert.equal(quantity.props.disabled, true);
  assert.equal(quantity.props.min, "0.0001");
  assert.equal(quantity.props.max, "99999999999999");
  const toggle = nodes.find((node) => node?.props?.type === "checkbox" && node.props.checked);
  toggle.props.onChange({ target: { checked: false } });
  assert.deepEqual(toggles.pop(), ["packagePrice", false]);
  assert.doesNotMatch(render(Fields, props), /Quantidade de pacotes/);
  const create = render(Fields, { ...props, value: { ...value, packageCount: 4 }, enabledFields: undefined });
  assert.match(create, /Quantidade de pacotes/);
  assert.doesNotMatch(create, /type="checkbox"/);
  assert.equal(descendants(Fields({ ...props, enabledFields: undefined })).find((node) => node?.props?.type === "date").props.autoFocus, true);
  const locked = descendants(Fields({ ...props, disabled: true }));
  assert.ok(locked.filter((node) => node?.props?.type === "checkbox" || node?.props?.type === "number").every((node) => node.props.disabled));
  const page = await readFile(path.join(root, "src", "pages", "stock", "StockPage", "index.tsx"), "utf8");
  assert.equal((page.match(/<StockEntryFields\b/g) ?? []).length, 2);
});

test("stock deletion reuses the confirmation dialog and blocks dismissal while saving", async () => {
  const { default: ConfirmDeleteDialog } = await load("ui/ConfirmDeleteDialog");
  let confirmations = 0;
  const props = { pendingDelete: { kind: "stock", id: "one", label: "Farinha — one" }, onCancel() {}, onConfirm: () => confirmations++ };
  const html = render(ConfirmDeleteDialog, props);
  assert.match(html, /Farinha — one/);
  assert.match(html, /Somente pacotes sem consumo, baixa ou correção/);
  assert.match(html, /Os demais pacotes da compra não serão alterados/);
  const busy = ConfirmDeleteDialog({ ...props, busy: true });
  assert.equal(busy.props.dismissDisabled, true);
  assert.equal(busy.props["aria-busy"], true);
  assert.ok(descendants(busy).filter((node) => node?.props?.onClick).every((node) => node.props.disabled));
  const ready = descendants(ConfirmDeleteDialog(props));
  ready.find((node) => node?.props?.onClick === props.onConfirm).props.onClick();
  assert.equal(confirmations, 1);
});

const listControls = (items) => ({
  items,
  pagination: { page: 1, pageSize: 10, totalCount: items.length, totalPages: 1, busy: false,
    onPageChange() {}, onPageSizeChange() {} },
  serverSort: { columns: {}, descending: false, onSort() {} },
  status: "ready",
});

test("stock rows use accessible icon actions and only offer joint editing for original purchases", async () => {
  const { default: StockPage } = await server.ssrLoadModule("/src/pages/stock/StockPage/index.tsx");
  const base = { marketItemId: "flour", itemName: "Farinha", unit: "g", entryDate: "2026-10-20",
    packageQty: 1000, packagePrice: 10, remainingQty: 1000, isActive: true, purchaseMixedItems: false };
  const stock = [{ ...base, id: "one", entryOrder: 2, purchaseLotCount: 3 }, { ...base, id: "two", entryOrder: 2, purchaseLotCount: 3 },
    { ...base, id: "empty", entryOrder: 2, remainingQty: 0, isActive: false, purchaseLotCount: 3 },
    { ...base, id: "other", entryOrder: 3, purchaseLotCount: 1 }];
  const props = { lots: listControls(stock), totals: listControls([]), marketCount: 1, search: "", onSearch() {},
    showInactive: false, onShowInactive() {}, loadPurchase: async () => [], disabled: false,
    addStock: async () => {}, adjustStock: async () => {}, updateStock: async () => {}, deleteStock: async () => {} };
  const html = render(StockPage, props);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Selecionar exibidos|Editar selecionados|Selecionar pacote/);
  assert.match(html, /aria-label="Editar compra de 3 pacotes: one"/);
  assert.doesNotMatch(html, /aria-label="Editar compra[^"]*: other"/);
  for (const action of ["Editar pacote one", "Dar baixa no pacote one", "Excluir pacote one"]) {
    assert.ok(html.includes(`aria-label="${action}"`));
  }
  assert.match(html, /aria-label="Dar baixa no pacote empty"[^>]*disabled=""/);
  assert.match(html, /title="Excluir pacote"[^>]*><svg/);
  const mixed = render(StockPage, { ...props, lots: listControls(stock.map((lot) =>
    lot.entryOrder === 2 ? { ...lot, purchaseMixedItems: true } : lot)) });
  assert.match(mixed, /title="Compra com insumos diferentes: edite cada pacote individualmente" disabled=""/);
});

test("shared production fields recalculate yields and preserve immutable saved fields", async () => {
  const { default: ProductionFields } = await load("production/ProductionFields");
  for (const variant of ["default", "registration"]) {
    const patches = [];
    const fields = ProductionFields({ value: production, variant, onChange: (patch) => patches.push(patch) });
    const field = (label) => children(fields).find((child) => child.props.label === label);
    const recipeSelect = children(field("Receita"))[0];
    assert.equal(recipeSelect.props.selectedLabel, "Cookies");
    recipeSelect.props.onChange("b", recipes[1]);
    assert.deepEqual(patches.pop(), { recipeId: "b", recipeName: "Bolo", yieldPerBatch: 12, actualYield: 24 });
    children(field("Quantidade de lotes"))[0].props.onChange({ target: { value: "3.5" } });
    assert.deepEqual(patches.pop(), { quantity: 3.5, actualYield: 105 });
    assert.equal(children(field("Perdas"))[0].props.max, 60);
    assert.equal(children(field("Quantidade por pacote"))[0].props.min, "0.0001");
    const html = render(ProductionFields, { value: production, variant, locked: true, onChange() {} });
    assert.match(html, /role="combobox"[^>]*disabled=""/);
    assert.match(html, /disabled=""[^>]*type="number"[^>]*min="0.0001"/);
  }
  const patches = [];
  const locked = ProductionFields({ value: production, locked: true, onChange: (patch) => patches.push(patch) });
  const recipe = children(locked).find((field) => field.props.label === "Receita");
  const quantity = children(locked).find((field) => field.props.label === "Quantidade de lotes");
  children(recipe)[0].props.onChange("b", recipes[1]);
  children(quantity)[0].props.onChange({ target: { value: "9" } });
  assert.deepEqual(patches, []);
  assert.match(render(ProductionFields, { value: production, locked: true, onChange() {} }), /Cookies/);
});

test("recipe fields share constraints and changes across registration and detail", async () => {
  const { default: RecipeFields } = await load("recipes/RecipeFields");
  for (const variant of ["default", "registration"]) {
    const patches = [];
    const fields = RecipeFields({ value: recipes[0], variant, onChange: (patch) => patches.push(patch) });
    const field = (label) => children(fields).find((child) => child.props.label === label);
    const name = children(field("Nome da receita"))[0];
    assert.equal(name.props.maxLength, 120);
    name.props.onChange({ target: { value: "Biscoitos" } });
    assert.deepEqual(patches.pop(), { name: "Biscoitos" });
    children(field("Rendimento por lote"))[0].props.onChange({ target: { value: "-5" } });
    assert.deepEqual(patches.pop(), { yield: 0 });
    assert.equal(children(field("Horas por receita"))[0].props.step, "0.1");
  }
});

test("ingredient editor prevents duplicate choices and delegates updates, additions and removals", async () => {
  const { default: Editor } = await load("recipes/RecipeIngredientsEditor");
  const changes = [];
  const removals = [];
  let additions = 0;
  const rows = [{ id: "one", marketItemId: "z", quantity: 2 }, { id: "two", marketItemId: "a", quantity: 100 }];
  const paging = (totalCount) => ({ page: 1, pageSize: 10, totalCount, totalPages: Math.ceil(totalCount / 10), busy: false,
    onPageChange: () => {}, onPageSizeChange: () => {} });
  const props = {
    rows, totalCount: 2, selectedIds: ["z", "a"], hasEmptyRow: false, pagination: paging(2),
    serverSort: { columns: { 0: "name", 1: "quantity", 2: "unit" }, descending: false, onSort: () => {} },
    marketCount: 2, onChange: (...args) => changes.push(args), onRemove: (index) => removals.push(index), onAdd: () => additions++,
  };
  const addButton = (element) => element.props.action.props.children.at(-1);
  const editor = capture(Editor, props);
  assert.equal(addButton(editor).props.disabled, true);
  const nodes = descendants(editor);
  const selects = nodes.filter((node) => node?.props?.["aria-label"] === "Pesquisar insumo");
  assert.deepEqual(selects[0].props.disabledValues, ["z", "a"]);
  selects[0].props.onChange("b", { id: "b", name: "Açúcar", unit: "g", ingredientCount: 0 });
  assert.deepEqual(changes.pop(), [0, { marketItemId: "b" }]);
  nodes.find((node) => node?.props?.["aria-label"] === "Quantidade usada por lote").props.onChange({ target: { value: "3.5" } });
  assert.deepEqual(changes.pop(), [0, { quantity: 3.5 }]);
  nodes.find((node) => node?.props?.["aria-label"] === "Remover ingrediente").props.onClick();
  assert.deepEqual(removals, [0]);
  const available = capture(Editor, { ...props, marketCount: 3 });
  assert.equal(addButton(available).props.disabled, false);
  addButton(available).props.onClick();
  assert.equal(additions, 1);
  const withEmptyRow = capture(Editor, { ...props, marketCount: 3, hasEmptyRow: true });
  assert.equal(addButton(withEmptyRow).props.disabled, true);
  // The whole recipe counts, not only the loaded page: 32 ingredients use every market item.
  assert.equal(addButton(capture(Editor, { ...props, marketCount: 32, totalCount: 32 })).props.disabled, true);
  assert.match(render(Editor, { ...props, rows: [], totalCount: 0, pagination: paging(0), marketCount: 0 }), /Cadastre insumos primeiro/);
  assert.match(render(Editor, { ...props, rows: [], status: "loading" }), /Carregando ingredientes/);
  // Rows come already paged by the server; the pager reflects the server total.
  const paged = render(Editor, { ...props, totalCount: 32, pagination: paging(32), marketCount: 40 });
  assert.equal((paged.match(/aria-label="Quantidade usada por lote"/g) ?? []).length, 2);
  assert.match(paged, /32 ingredientes/);
  assert.ok(!render(Editor, props).includes("ingredientes</span>"));
  const searched = capture(Editor, { ...props, search: "fa", onSearch: (value) => changes.push(["search", value]) });
  searched.props.action.props.children[0].props.onChange({ target: { value: "farinha" } });
  assert.deepEqual(changes.pop(), ["search", "farinha"]);
});

test("form layout owns disabled fieldsets and shared grids preserve native submission", async () => {
  const { default: FormLayout, FormGrid } = await load("ui/FormLayout");
  const { default: FormActions } = await load("ui/FormActions");
  const onSubmit = () => {};
  const form = FormLayout({ disabled: true, onSubmit, children: "Campos", className: "local" });
  assert.equal(form.props.onSubmit, onSubmit);
  assert.equal(form.props.children.type, "fieldset");
  assert.equal(form.props.children.props.disabled, true);
  assert.ok(form.props.className.includes("local"));
  const html = render(FormLayout, {
    disabled: true,
    children: createElement(FormGrid, null, createElement(FormActions, { onCancel() {}, submitLabel: "Salvar venda" })),
  });
  assert.match(html, /<fieldset[^>]*disabled=""/);
  assert.match(html, /type="button"[^>]*>Cancelar/);
  assert.match(html, /type="submit"[^>]*>Salvar venda/);
});

test("panels associate unique headings and compact metrics retain negative results and captions", async () => {
  const { default: Panel } = await load("ui/Panel");
  const { default: MetricCard, MetricGrid } = await load("ui/MetricCard");
  const html = render(Panel, { title: "Resultados", description: "Custos reais", children:
    createElement(MetricGrid, { variant: "simulation", "aria-live": "polite" },
      createElement(MetricCard, { variant: "compact", label: "Resultado", value: "-R$ 10", caption: "Custo histórico", negative: true })),
  });
  const id = html.match(/aria-labelledby="([^"]+)"/)[1];
  assert.ok(html.includes(`<h2 id="${id}">Resultados</h2>`));
  assert.match(html, /Custos reais/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /sales-loss[^"]*">-R\$ 10/);
  assert.match(html, /Custo histórico/);
  const panels = renderToStaticMarkup(createElement(Fragment, null,
    createElement(Panel, { title: "Primeiro" }), createElement(Panel, { title: "Segundo" })));
  const ids = [...panels.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, 2);
});

test("shared form and metric grids own desktop, tablet and mobile breakpoints", () => {
  const form = sass.compile(path.join(root, "src", "components", "ui", "FormLayout", "styles.module.scss")).css;
  assert.match(form, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(form, /@media \(max-width: 480px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  const metric = sass.compile(path.join(root, "src", "components", "ui", "MetricCard", "styles.module.scss")).css;
  assert.match(metric, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(metric, /@media \(max-width: 920px\)[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(metric, /@media \(max-width: 680px\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(metric, /\.results \.metric-card\.compact > strong\s*\{\s*font-size: 13px;/);
});

test("busy registration dialogs disable close and expose their pending state", async () => {
  const { default: Modal } = await load("ui/RegistrationModal");
  const html = render(Modal, { title: "Cadastrar produção", busy: true, onClose() {} });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Fechar"[^>]*disabled=""/);
});

test("standalone production asks for a manual total cost and split button offers both registrations", async () => {
  const { default: Fields } = await load("production/ProductionFields");
  assert.doesNotMatch(render(Fields, { value: production, onChange: () => {} }), /Custo total da produção/);
  const changes = [];
  const standalone = { ...production, isStandalone: true, totalCost: null };
  assert.match(render(Fields, { value: standalone, onChange: () => {} }), /Custo total da produção/);
  const cost = descendants(Fields({ value: standalone, onChange: (patch) => changes.push(patch) }))
    .find((node) => node?.props?.step === "0.01" && node.props.value === "");
  assert.equal(cost.props.required, true);
  cost.props.onChange({ target: { value: "42.5" } });
  assert.deepEqual(changes.pop(), { totalCost: 42.5 });
  const { default: SplitButton } = await load("ui/SplitButton");
  const html = render(SplitButton, { onClick: () => {}, menuLabel: "Mais opções", options: [], children: "Registrar produção" });
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-expanded="false"/);
  const page = await readFile(path.join(root, "src", "pages", "production", "ProductionsPage", "index.tsx"), "utf8");
  assert.match(page, /Registrar produção avulsa/);
});
