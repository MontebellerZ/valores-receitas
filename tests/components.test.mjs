import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ts from "typescript";
import * as sass from "sass";
import postcss from "postcss";

const root = fileURLToPath(new URL("../", import.meta.url));
const src = path.join(root, "src");
let server;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  }));
  return files.flat();
}

const moduleUrl = (file) => `/${path.relative(root, file).split(path.sep).join("/")}`;
const load = (relative) => server.ssrLoadModule(moduleUrl(path.join(src, relative)));
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));

before(async () => {
  server = await createServer({
    root,
    server: { middlewareMode: true, hmr: false },
    logLevel: "silent",
  });
});
after(async () => { await server?.close(); });

test("package flow shows production buyers below lost packages with quantities and spending", async () => {
  const { default: PackageFlow } = await load(path.join("components", "production", "PackageFlow", "index.tsx"));
  const { money } = await load(path.join("utils", "format.ts"));
  const props = {
    production: { packages: 30, lostPackages: 1 },
    report: { soldPackages: 14, donatedPackages: 2, lostPackages: 1, availablePackages: 13 },
    topBuyers: [
      { customer: "Ana", packages: 11, spent: 16.5 },
      { customer: "Bruno", packages: 3, spent: 60 },
    ],
    onLostChange: () => {},
  };
  const markup = render(PackageFlow, props);
  assert.ok(markup.indexOf("Pacotes perdidos") < markup.indexOf("Top 5 compradores"));
  assert.ok(markup.indexOf("Ana") < markup.indexOf("Bruno"));
  assert.match(markup, /11 pacote\(s\)/);
  assert.ok(markup.includes(money(16.5)));
  assert.ok(markup.includes(money(60)));
  assert.match(markup, /compras ainda não pagas/);
  assert.match(markup, /não inclui doações/);
  assert.match(render(PackageFlow, { ...props, topBuyers: [] }), /Nenhuma compra registrada nesta produção/);
  assert.match(render(PackageFlow, { ...props, topBuyers: [{ customer: "", packages: 1, spent: 5 }] }),
    /Cliente não informado/);
});

test("every frontend component has an index and an adjacent SCSS module", async () => {
  const files = await filesIn(src);
  const components = files.filter((file) => file.endsWith(".tsx") && path.basename(file) !== "main.tsx");
  assert.ok(components.length > 0);
  for (const file of components) {
    assert.equal(path.basename(file), "index.tsx", file);
    const stylesFile = path.join(path.dirname(file), "styles.module.scss");
    assert.ok(files.includes(stylesFile), `Missing stylesheet for ${file}`);
  }
  assert.deepEqual(files.filter((file) => file.endsWith(".css")), [path.join(src, "index.css")]);
});

test("component class references exist in their compiled CSS Modules", async () => {
  const components = (await filesIn(src)).filter((file) => path.basename(file) === "index.tsx");
  for (const file of components) {
    const source = await readFile(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const stylesheet = path.join(path.dirname(file), "styles.module.scss");
    const { default: styles } = await server.ssrLoadModule(moduleUrl(stylesheet));
    function visit(node) {
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "className") {
        assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), `Global class in ${file}`);
      }
      if (ts.isElementAccessExpression(node) && node.expression.getText(ast) === "styles") {
        assert.ok(ts.isStringLiteral(node.argumentExpression), `Nonliteral style key in ${file}`);
        assert.ok(styles[node.argumentExpression.text], `Missing ${node.argumentExpression.text} in ${stylesheet}`);
      }
      if (ts.isPropertyAccessExpression(node) && node.expression.getText(ast) === "styles") {
        assert.ok(styles[node.name.text], `Missing ${node.name.text} in ${stylesheet}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});

test("global stylesheet contains only document theme and resets", async () => {
  const css = postcss.parse(await readFile(path.join(src, "index.css"), "utf8"));
  css.walkRules((rule) => {
    assert.ok(!/\.[a-zA-Z_-]/.test(rule.selector), `Global component selector: ${rule.selector}`);
  });
});

test("all textual inputs, selects and textareas use the shared form control", async () => {
  const files = (await filesIn(src)).filter((file) => file.endsWith(".tsx"));
  let controls = 0;
  for (const file of files) {
    if (path.basename(path.dirname(file)) === "FormControl") continue;
    const source = await readFile(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(ast);
        if (tag === "FormControl") controls++;
        if (["input", "select", "textarea"].includes(tag)) {
          const type = node.attributes.properties.find((attribute) => attribute.name?.getText(ast) === "type")?.initializer;
          assert.ok(tag === "input" && type && ts.isStringLiteral(type) && ["checkbox", "file"].includes(type.text), `Unstyled control in ${file}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.ok(controls > 0, "The scan must encounter shared controls");
});

test("form control forwards native attributes, handlers, refs and element-specific props", async () => {
  const { default: FormControl } = await load(path.join("components", "ui", "FormControl", "index.tsx"));
  const { default: styles } = await load(path.join("components", "ui", "FormControl", "styles.module.scss"));
  const onChange = () => { };
  const onKeyDown = () => { };
  const ref = { current: null };
  const options = createElement("option", { value: "g" }, "Gramas");
  for (const as of ["input", "select", "textarea"]) {
    const props = {
      as, id: "field", name: "quantity", required: true, disabled: true,
      value: as === "select" ? "g" : "12", onChange, onKeyDown, ref,
      "aria-invalid": true, "aria-describedby": "field-error", className: "layout",
      prefix: "R$", suffix: "un.", controlSize: "compact",
      ...(as === "input" ? { type: "number", min: "0", max: "20", step: "0.1" } : {}),
      ...(as === "select" ? { children: options } : {}),
      ...(as === "textarea" ? { rows: 3, maxLength: 500 } : {}),
    };
    const frame = FormControl(props);
    assert.ok(frame.props.className.includes(styles.frame));
    assert.ok(frame.props.className.includes(styles.compact));
    assert.ok(frame.props.className.includes("layout"));
    const control = frame.props.children[1];
    assert.equal(control.type, as);
    assert.equal(control.props.className, styles.control);
    assert.equal(control.props.onChange, onChange);
    assert.equal(control.props.onKeyDown, onKeyDown);
    assert.equal(control.props.ref, ref);
    assert.equal(control.props.required, true);
    assert.equal(control.props.disabled, true);
    assert.equal(control.props["aria-invalid"], true);
    assert.equal(control.props["aria-describedby"], "field-error");
    assert.equal(control.props.id, "field");
    assert.equal(control.props.name, "quantity");
    assert.equal(control.props.as, undefined);
    assert.equal(control.props.prefix, undefined);
    assert.equal(control.props.suffix, undefined);
    assert.equal(control.props.controlSize, undefined);
    if (as === "input") {
      assert.equal(control.props.type, "number");
      assert.equal(control.props.min, "0");
      assert.equal(control.props.max, "20");
      assert.equal(control.props.step, "0.1");
    }
    if (as === "select") assert.equal(control.props.children, options);
    if (as === "textarea") {
      assert.equal(control.props.rows, 3);
      assert.equal(control.props.maxLength, 500);
      assert.ok(frame.props.className.includes(styles.multiline));
    }
    const html = render(FormControl, props);
    assert.ok(html.includes("R$"));
    assert.ok(html.includes("un."));
    assert.ok(!html.includes("controlSize"));
  }
  const defaultInput = FormControl({ defaultValue: "Nome", controlSize: "large" });
  assert.equal(defaultInput.props.children[1].type, "input");
  assert.equal(defaultInput.props.children[1].props.defaultValue, "Nome");
  assert.ok(defaultInput.props.className.includes(styles.large));
});

test("all application selects reuse the shared searchable select", async () => {
  const files = (await filesIn(src)).filter((file) => file.endsWith(".tsx"));
  const consumers = [];
  for (const file of files) {
    if (path.basename(path.dirname(file)) === "FormControl") continue;
    const source = await readFile(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        assert.notEqual(node.tagName.getText(ast), "select", `Native select in ${file}`);
        for (const attribute of node.attributes.properties) {
          if (ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "as" &&
              attribute.initializer && ts.isStringLiteral(attribute.initializer)) {
            assert.notEqual(attribute.initializer.text, "select", `Nonsearchable select in ${file}`);
          }
        }
        if (["SearchableSelect", "RemoteSelect"].includes(node.tagName.getText(ast)))
          consumers.push(path.basename(path.dirname(file)));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  // RemoteSelect is the server-searched variant built on SearchableSelect; Pagination picks the page size.
  assert.deepEqual([...new Set(consumers)].sort(), [
    "OverviewPage", "Pagination", "ProductionFields", "RecipeIngredientsEditor", "RemoteSelect", "SaleForm", "SalesPage",
    "StockEntryFields",
  ].sort());
});

test("searchable select renders selected labels, empty filters and disabled/required states", async () => {
  const { default: SearchableSelect } = await load(path.join("components", "ui", "SearchableSelect", "index.tsx"));
  const options = [{ value: "", label: "Todas as produções" }, { value: "one", label: "Pão · 19/10/2026", disabled: true }];
  const props = { options, onChange() {}, "aria-label": "Produção" };
  const selected = render(SearchableSelect, { ...props, value: "one", disabled: true, required: true });
  assert.match(selected, /role="combobox"/);
  assert.match(selected, /aria-required="true"/);
  assert.match(selected, /disabled=""/);
  assert.match(selected, /value="Pão · 19\/10\/2026"/);
  assert.ok(!selected.includes("<select"));
  assert.match(render(SearchableSelect, { ...props, value: "" }), /value="Todas as produções"/);
  assert.match(render(SearchableSelect, { ...props, options: [], value: "", placeholder: "Selecione uma produção" }), /placeholder="Selecione uma produção"/);
});

test("buttons retain native semantics, accessible names and shared variants", async () => {
  const { default: Button, ButtonLink } = await load(path.join("components", "ui", "Button", "index.tsx"));
  const { default: IconButton } = await load(path.join("components", "ui", "IconButton", "index.tsx"));
  const { default: BackButton } = await load(path.join("components", "ui", "BackButton", "index.tsx"));
  const { default: styles } = await load(path.join("components", "ui", "Button", "styles.module.scss"));
  const ordinary = render(Button, { children: "Adicionar" });
  assert.match(ordinary, /type="button"/);
  assert.ok(ordinary.includes(styles["button-primary"]));
  const submit = render(Button, { type: "submit", disabled: true, variant: "secondary", size: "small", children: "Salvar" });
  assert.match(submit, /type="submit"/);
  assert.match(submit, /disabled=""/);
  assert.ok(submit.includes(styles["button-secondary"]));
  assert.ok(submit.includes(styles["button-small"]));
  const icon = render(IconButton, { "aria-label": "Excluir receita", danger: true, disabled: true, children: "X" });
  assert.match(icon, /aria-label="Excluir receita"/);
  assert.match(icon, /type="button"/);
  assert.match(icon, /disabled=""/);
  assert.ok(!icon.includes('danger="'));
  assert.match(render(BackButton, { children: "Voltar para receitas" }), /Voltar para receitas/);
  const link = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(ButtonLink, { to: "/receitas", variant: "secondary" }, "Receitas")));
  assert.match(link, /href="\/receitas"/);
  assert.ok(link.includes(styles["button-secondary"]));
});

test("field, search and form actions preserve labels, constraints and submit behavior", async () => {
  const { default: FormField } = await load(path.join("components", "ui", "FormField", "index.tsx"));
  const { default: FormControl } = await load(path.join("components", "ui", "FormControl", "index.tsx"));
  const { default: SearchField } = await load(path.join("components", "ui", "SearchField", "index.tsx"));
  const { default: FormActions } = await load(path.join("components", "ui", "FormActions", "index.tsx"));
  const field = render(FormField, {
    label: "Quantidade", htmlFor: "qty", variant: "registration",
    children: createElement(FormControl, { id: "qty", type: "number", min: 1, required: true, disabled: true }),
  });
  assert.match(field, /<label[^>]*for="qty"/);
  assert.match(field, /<span>Quantidade<\/span>/);
  assert.match(field, /<input[^>]*min="1"[^>]*required=""[^>]*disabled=""/);
  const search = render(SearchField, { "aria-label": "Buscar vendas", value: "Cookies", onChange() {}, disabled: true });
  assert.match(search, /aria-label="Buscar vendas"/);
  assert.match(search, /value="Cookies"/);
  assert.match(search, /<svg/);
  const actions = render(FormActions, { onCancel() {}, submitLabel: "Cadastrando...", disabled: true, cancelDisabled: true });
  assert.match(actions, /type="button"[^>]*>Cancelar/);
  assert.match(actions, /type="submit"[^>]*>Cadastrando/);
  assert.equal((actions.match(/disabled=""/g) ?? []).length, 2);
});

test("tables, empty states and summaries share presentation without losing content", async () => {
  const { default: DataTable } = await load(path.join("components", "ui", "DataTable", "index.tsx"));
  const { default: EmptyState } = await load(path.join("components", "ui", "EmptyState", "index.tsx"));
  const { default: SummaryItem, SummaryList } = await load(path.join("components", "ui", "SummaryItem", "index.tsx"));
  const { default: styles } = await load(path.join("components", "ui", "DataTable", "styles.module.scss"));
  for (const variant of ["default", "sales", "compact"]) {
    const table = render(DataTable, { variant, "aria-label": "Lotes", children: createElement("caption", null, "Compras") });
    assert.ok(table.includes(styles["table-scroll"]));
    assert.match(table, /<table[^>]*aria-label="Lotes"/);
    assert.match(table, /<caption>Compras<\/caption>/);
    if (variant === "sales") assert.ok(table.includes(styles["sales-table"]));
    if (variant === "compact") assert.ok(table.includes(styles.compact));
  }
  const empty = render(EmptyState, { variant: "editor", title: "Nenhuma produção", children: createElement("p", null, "Cadastre uma receita."), action: createElement("button", null, "Cadastrar") });
  assert.match(empty, /<h2>Nenhuma produção<\/h2>/);
  assert.match(empty, /Cadastre uma receita/);
  assert.match(empty, />Cadastrar<\/button>/);
  const summary = render(SummaryList, { "aria-label": "Receitas", children: createElement(SummaryItem, {
    name: "", title: "Receita sem nome", description: "Sem categoria",
    metrics: [{ label: "Ingredientes", value: "2" }],
    viewLabel: "Visualizar receita sem nome", viewTitle: "Visualizar receita", onView() {},
  }) });
  assert.match(summary, /aria-label="Receitas"/);
  assert.match(summary, /<h2>Receita sem nome<\/h2>/);
  assert.match(summary, /<dt>Ingredientes<\/dt><dd>2<\/dd>/);
  assert.match(summary, /aria-label="Visualizar receita sem nome"/);
});

test("registration and deletion dialogs use the same accessible dialog foundation", async () => {
  const { default: RegistrationModal } = await load(path.join("components", "ui", "RegistrationModal", "index.tsx"));
  const { default: ConfirmDeleteDialog } = await load(path.join("components", "ui", "ConfirmDeleteDialog", "index.tsx"));
  const modal = render(RegistrationModal, { title: "Cadastrar insumo", onClose() {}, children: "Formulário" });
  assert.match(modal, /role="dialog" aria-modal="true"/);
  assert.match(modal, /aria-label="Cadastrar insumo"/);
  assert.match(modal, /aria-label="Fechar"/);
  assert.equal(render(ConfirmDeleteDialog, { pendingDelete: null, onCancel() {}, onConfirm() {} }), "");
  for (const kind of ["recipe", "production", "sale", "market", "ingredient"]) {
    const confirm = render(ConfirmDeleteDialog, { pendingDelete: { kind, label: "Cookies", ingredientCount: 2 }, onCancel() {}, onConfirm() {} });
    assert.match(confirm, /role="dialog" aria-modal="true"/);
    assert.match(confirm, /aria-labelledby="confirm-title"/);
    assert.match(confirm, /aria-describedby="confirm-description"/);
    assert.ok(confirm.includes("Cookies"));
    assert.match(confirm, />Cancelar<\/button>/);
  }
});

test("shared UI patterns are reused across consumers instead of copied into pages", async () => {
  const owners = {
    Button: ["button", "button-primary", "button-secondary", "text-button", "inline-link"],
    IconButton: ["icon-button", "mini-icon-button", "delete-item", "view-item"],
    DataTable: ["table-scroll", "data-table", "sales-table"],
    EmptyState: ["empty-inline", "empty-editor", "empty-illustration"],
    SummaryItem: ["item-summary", "item-summary-name", "item-summary-metrics", "item-list"],
  };
  const consumers = Object.fromEntries([
    ...Object.keys(owners), "FormField", "SearchField", "FormActions", "BackButton", "Dialog",
    "FormLayout", "FormGrid", "Panel", "MetricGrid", "ProductionFields", "RecipeFields", "RecipeIngredientsEditor",
    "Pagination", "RemoteSelect",
  ].map(name => [name, new Set()]));
  for (const file of (await filesIn(src)).filter(file => file.endsWith(".tsx"))) {
    const source = await readFile(file, "utf8");
    const component = path.basename(path.dirname(file));
    for (const match of source.matchAll(/from\s+["']([^"']+styles\.module\.scss)["']/g)) {
      assert.equal(match[1], "./styles.module.scss", `Do not import another component's styles in ${file}`);
    }
    for (const [owner, classes] of Object.entries(owners)) {
      if (component === owner) continue;
      for (const name of classes) assert.ok(!source.includes(`styles["${name}"]`), `Reuse ${owner} instead of ${name} in ${file}`);
    }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(ast);
        if (consumers[tag] && component !== tag) consumers[tag].add(file);
        if (tag === "table") assert.equal(component, "DataTable", `Reuse DataTable in ${file}`);
        if (tag === "button") assert.ok(["Button", "IconButton", "SearchableSelect"].includes(component), `Reuse Button or IconButton in ${file}`);
        if (tag === "label") assert.ok(["FormField", "SaleForm"].includes(component), `Reuse FormField in ${file}`);
        if (node.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === "role" && a.initializer?.getText(ast) === '"dialog"')) {
          assert.equal(component, "Dialog", `Reuse Dialog in ${file}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const [component, files] of Object.entries(consumers)) {
    assert.ok(files.size >= 2, `${component} should be reused by at least two consumers, got ${files.size}`);
  }
});

test("sales registration renders one editor and a selectable cart sidebar while edits remain individual", async () => {
  const { default: SaleForm } = await load(path.join("components", "sales", "SaleForm", "index.tsx"));
  const balance = { id: "p1", recipeId: "r1", recipeName: "Bolo", date: "2026-10-20", quantity: 1, packages: 5, salePrice: 10,
    soldPackages: 0, availablePackages: 5, lostPackages: 0, periodSales: { count: 0, packages: 0, revenue: 0, cost: 0 } };
  const props = {
    initialBalance: balance, totalAvailable: 5,
    onSave: async () => undefined, onSaveSales: async () => undefined, onCancel: () => {},
  };
  const cart = render(SaleForm, props);
  assert.match(cart, /Venda 1/);
  assert.match(cart, /Adicionar outra venda/);
  assert.match(cart, /Confirmar vendas/);
  assert.match(cart, /Total do carrinho/);
  assert.match(cart, /Total da venda:/);
  assert.match(cart, /<aside[^>]*aria-label="Carrinho de vendas"/);
  assert.match(cart, /aria-label="Editar venda 1"[^>]*aria-pressed="true"/);
  assert.match(cart, /Cliente não informado/);
  assert.match(cart, /1 pacote\(s\)/);
  assert.equal((cart.match(/type="number"/g) ?? []).length, 1);
  assert.equal((cart.match(/role="combobox"/g) ?? []).length, 1);
  assert.doesNotMatch(cart, /Remover venda 1/);
  const sale = { id: "s1", productionId: "p1", productionDate: "2026-10-20",
    recipeName: "Bolo", date: "2026-10-22", packages: 5, pricePerPackage: 8,
    costPerPackage: 2, customer: "Ana", paid: false, notes: "Entrega" };
  // The server sold total includes the edited sale itself, which is released while editing it.
  const edit = render(SaleForm, { ...props, sale, initialBalance: { ...balance, soldPackages: 5, availablePackages: 0 } });
  assert.match(edit, /Salvar venda/);
  assert.match(edit, /value="Ana"/);
  assert.match(edit, /value="2026-10-22"/);
  assert.match(edit, /max="5"/);
  assert.doesNotMatch(edit, /Adicionar outra venda|Confirmar vendas|Total do carrinho|<aside/);
  const empty = render(SaleForm, { ...props, initialBalance: null, totalAvailable: 0 });
  assert.match(empty, /Não há mais pacotes disponíveis/);
  assert.match(empty, /<button[^>]*disabled=""[^>]*>[\s\S]*?Adicionar outra venda/);
});

test("market and recipe inputs share the same control styles and preserve stock locks", async () => {
  const { default: MarketPage } = await load(path.join("pages", "market", "MarketPage", "index.tsx"));
  const { default: RecipeDetailPage } = await load(path.join("pages", "recipes", "RecipeDetailPage", "index.tsx"));
  const { default: styles } = await load(path.join("components", "ui", "FormControl", "styles.module.scss"));
  const item = { id: "flour", name: "Farinha", unit: "g", hasStockHistory: true };
  const noop = () => { };
  const recipe = { id: "cookies", name: "Cookies", category: "Doces", yield: 30, hoursPerBatch: 8, ingredients: [] };
  const market = render(MarketPage, {
    items: [item], created: [], totalCount: 1, search: "", onSearch: noop,
    pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1, busy: false, onPageChange: noop, onPageSizeChange: noop },
    serverSort: { columns: { 0: "name" }, sortBy: "name", descending: false, onSort: noop }, status: "ready",
    updateMarket: noop, addMarketItem: noop, onRequestDelete: noop,
  });
  const detail = render(RecipeDetailPage, {
    recipe: { ...recipe, ingredientCount: 0 }, ingredients: [], marketCount: 1, updateRecipe: noop, updateIngredient: noop,
    addIngredient: noop, onRequestDelete: noop, onBack: noop, onCreate: noop,
  });
  // Search, name, unit and the page-size picker.
  assert.equal(market.match(new RegExp(styles.control, "g")).length, 4);
  assert.ok(detail.includes(styles.control));
  assert.ok(detail.includes("un./lote"));
  assert.ok(detail.includes("horas"));
  assert.match(market, /<input[^>]*aria-label="Unidade de medida"[^>]*disabled=""/);
  assert.ok(!market.includes('aria-label="Quantidade por pacote"'));
  assert.ok(!market.includes("Qtd. por pacote"));
});

test("metric variants and negative results use the component's local classes", async () => {
  const { default: MetricCard } = await load(path.join("components", "ui", "MetricCard", "index.tsx"));
  const { default: styles } = await load(path.join("components", "ui", "MetricCard", "styles.module.scss"));
  const props = { label: "Resultado", value: "-R$ 10", caption: "Ingredientes" };
  const normal = render(MetricCard, props);
  assert.ok(normal.includes(styles["metric-card"]));
  assert.ok(!normal.includes(styles.overview));
  assert.ok(!normal.includes(styles["sales-loss"]));
  const negative = render(MetricCard, { ...props, negative: true, variant: "overview" });
  assert.ok(negative.includes(styles.overview));
  assert.ok(negative.includes(styles["sales-loss"]));
});

test("page header retains its default and welcome variants", async () => {
  const { default: PageHeader } = await load(path.join("components", "ui", "PageHeader", "index.tsx"));
  const { default: styles } = await load(path.join("components", "ui", "PageHeader", "styles.module.scss"));
  const standard = render(PageHeader, { title: "Receitas", className: "custom-header" });
  assert.ok(standard.includes(styles["welcome-row"]));
  assert.ok(standard.includes(styles["page-title-row"]));
  assert.ok(standard.includes(styles.title));
  assert.ok(standard.includes("custom-header"));
  const welcome = render(PageHeader, { title: "Visão geral", variant: "welcome" });
  assert.ok(welcome.includes(styles["welcome-row"]));
  assert.ok(!welcome.includes(styles["page-title-row"]));
});

test("payment badges preserve both localized payment states", async () => {
  const { default: PaymentBadge } = await load(path.join("components", "ui", "PaymentBadge", "index.tsx"));
  const { default: styles } = await load(path.join("components", "ui", "PaymentBadge", "styles.module.scss"));
  assert.ok(render(PaymentBadge, { paid: true }).includes(styles["is-paid"]));
  const pending = render(PaymentBadge, { paid: false });
  assert.ok(pending.includes("A receber"));
  assert.ok(pending.includes(styles["sales-payment"]));
  assert.ok(!pending.includes(styles["is-paid"]));
  const donated = render(PaymentBadge, { paid: true, donated: true });
  assert.ok(donated.includes("Doado"));
  assert.ok(donated.includes(styles["is-donated"]));
});

test("layout retains active navigation and each synchronization state", async () => {
  const { default: AppLayout } = await load(path.join("components", "layout", "AppLayout", "index.tsx"));
  const { default: styles } = await load(path.join("components", "layout", "AppLayout", "styles.module.scss"));
  const props = {
    session: { id: "test", email: "test@example.test" },
    recipeCount: 1, productionCount: 2, salesCount: 3, marketCount: 4,
    signOut() { }, exportWorkbook() { },
  };
  for (const apiStatus of ["error", "saving", "connecting", "connected"]) {
    const html = renderToStaticMarkup(createElement(
      MemoryRouter,
      { initialEntries: ["/receitas"] },
      createElement(AppLayout, { ...props, apiStatus }),
    ));
    assert.ok(html.includes(`class="${styles["nav-item"]} ${styles.active}"`));
    assert.equal(html.includes(styles["is-error"]), apiStatus === "error");
    assert.equal(html.includes(styles["is-saving"]), apiStatus === "saving" || apiStatus === "connecting");
    assert.ok(html.includes(styles["status-dot"]));
  }
});

test("responsive styles and portal/dialog rules survive Sass compilation", () => {
  function cssFor(...segments) {
    return sass.compile(path.join(src, ...segments, "styles.module.scss")).css;
  }
  const layout = cssFor("components", "layout", "AppLayout");
  assert.match(layout, /@media \(max-width: 920px\)/);
  assert.match(layout, /@media \(max-width: 680px\)/);
  const select = cssFor("components", "ui", "SearchableSelect");
  assert.match(select, /\.market-select-options\s*\{[^}]*position: fixed;[^}]*z-index: 1000;/);
  const dialog = cssFor("components", "ui", "ConfirmDeleteDialog");
  assert.match(dialog, /@keyframes confirm-enter/);
  assert.match(dialog, /prefers-reduced-motion: reduce/);
  const actions = postcss.parse(cssFor("pages", "overview", "OverviewPage"));
  const mobileSizes = [];
  actions.walkRules((rule) => {
    if (rule.selector.includes(".welcome-actions > button")) {
      rule.walkDecls("font-size", (declaration) => mobileSizes.push(declaration.value));
    }
  });
  assert.equal(mobileSizes.at(-1), "11px");
});

test("result chart only dates a cost recovery that happens inside the visible page", async () => {
  const { default: Charts } = await load(path.join("components", "production", "ProductionCharts", "index.tsx"));
  const day = (date, cumulativeRevenue) => ({ date, sold: 1, donated: 0, total: 1, revenue: 5, cumulativeRevenue });
  const label = (props) => render(Charts, { cost: 20, productionDate: "2026-01-01", ...props }).match(/aria-label="(Evolução do resultado[^"]*)"/)[1];
  const later = label({ includeStart: false, days: [day("2026-03-01", 60), day("2026-03-02", 105)] });
  assert.match(later, /Custo recuperado antes deste período\./);
  assert.ok(!later.includes("ainda não"));
  assert.ok(!later.includes("Custo recuperado em"));
  assert.match(label({ includeStart: false, days: [day("2026-01-02", 10), day("2026-01-03", 25)] }), /Custo recuperado em .*03/);
  assert.match(label({ days: [day("2026-01-02", 25), day("2026-01-03", 30)] }), /Custo recuperado em .*02/);
  assert.match(label({ includeStart: false, days: [day("2026-01-02", 5), day("2026-01-03", 10)] }), /ainda não foi recuperado/);
});
