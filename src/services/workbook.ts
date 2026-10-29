import type { MarketItem, Recipe, WorkspaceData } from "../domain/models";
import { calculateProduction } from "../domain/calculations";
import { makeId } from "../utils/format";
import {
  normalize,
  asNumber,
  asText,
  valueFor,
  type SheetRow,
} from "../utils/parsing";

function asShelfLife(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const days = Math.round(asNumber(value, -1));
  return days >= 0 ? days : null;
}

export async function exportWorkbook({
  market,
  recipes,
  productions,
  sales,
}: WorkspaceData) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      market.map((item) => ({
        Item: item.name,
        Unidade: item.unit,
      })),
    ),
    "Insumos",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      recipes.map((recipe) => ({
        Receita: recipe.name,
        Categoria: recipe.category,
        Rendimento: recipe.yield,
        "Horas por receita": recipe.hoursPerBatch,
        "Validade (dias)": recipe.shelfLifeDays ?? "",
      })),
    ),
    "Receitas",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      recipes.flatMap((recipe) =>
        recipe.ingredients.map((ingredient) => ({
          Receita: recipe.name,
          Item:
            market.find((item) => item.id === ingredient.marketItemId)?.name ??
            "Item removido",
          Quantidade: ingredient.quantity,
        })),
      ),
    ),
    "Ingredientes",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      productions.map((production) => {
        const result = calculateProduction(production);
        return {
          Data: production.date,
          Receita: production.recipeName,
          "Qtd. receitas": production.quantity,
          "Rendimento obtido": production.actualYield,
          Perdas: production.losses,
          "Rendimento líquido": result.produced,
          "Qtd. por pacote": production.packageQty,
          "Acréscimo sobre custo (%)": production.margin,
          Custo: result.cost,
          Pacotes: result.packages,
          "Pacotes perdidos": production.lostPackages ?? 0,
          "Preço sugerido": result.salePrice,
          Faturamento: result.revenue,
          Lucro: result.profit,
        };
      }),
    ),
    "Produções",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      sales.map((sale) => ({
        "Data da venda": sale.date,
        "Data da produção": sale.productionDate,
        Receita: sale.recipeName,
        Cliente: sale.customer,
        Pacotes: sale.packages,
        "Preço real por pacote": sale.pricePerPackage,
        Total: sale.packages * sale.pricePerPackage,
        Recebido: sale.paid ? "Sim" : "Não",
        Doado: sale.donated ? "Sim" : "Não",
        "Custo dos pacotes vendidos": sale.packages * sale.costPerPackage,
        "Resultado da venda":
          sale.packages * (sale.pricePerPackage - sale.costPerPackage),
        Observações: sale.notes,
      })),
    ),
    "Vendas",
  );
  XLSX.writeFile(workbook, "conta-de-chef.xlsx");
}

export async function importWorkbook(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheets = workbook.SheetNames.map((name) => ({
    name: normalize(name),
    rows: XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[name], {
      defval: "",
    }),
  }));
  const marketRows = sheets.flatMap(({ name, rows }) =>
    rows
      .filter(
        (row) =>
          valueFor(row, [
            "item",
            "produto",
            "insumo",
            "ingrediente",
            "material",
          ]) !== undefined &&
          valueFor(row, ["unidade", "un", "qtd pacote", "quantidade pacote", "peso"]) !== undefined,
      )
      .map((row) => ({ name, row })),
  );
  const importedItems: MarketItem[] = [];
  const itemIds = new Map<string, string>();
  for (const { row } of marketRows) {
    const itemName = asText(
      valueFor(row, ["item", "produto", "insumo", "ingrediente", "material"]),
    );
    if (!itemName) continue;
    const key = normalize(itemName);
    if (itemIds.has(key)) continue;
    const item: MarketItem = {
      id: makeId(),
      name: itemName,
      unit: asText(valueFor(row, ["unidade", "un"]), "g"),
    };
    itemIds.set(key, item.id);
    importedItems.push(item);
  }
  const recipeRows = sheets.flatMap(({ rows }) =>
    rows
      .filter(
        (row) =>
          valueFor(row, ["receita", "nome receita", "produto final"]) !==
          undefined,
      )
      .map((row) => row),
  );
  const grouped = new Map<string, Recipe>();
  for (const row of recipeRows) {
    const name = asText(
      valueFor(row, ["receita", "nome receita", "produto final"]),
    );
    if (!name) continue;
    const key = normalize(name);
    let recipe = grouped.get(key);
    if (!recipe) {
      recipe = {
        id: makeId(),
        name,
        category: asText(valueFor(row, ["categoria", "grupo"]), "Receitas"),
        yield: asNumber(
          valueFor(row, [
            "rendimento",
            "rendimento receita",
            "unidades por receita",
          ]),
          0,
        ),
        hoursPerBatch: asNumber(
          valueFor(row, [
            "horas por receita",
            "horas por lote",
            "tempo de preparo",
            "horas",
          ]),
          0,
        ),
        shelfLifeDays: asShelfLife(
          valueFor(row, ["validade (dias)", "validade", "validade em dias"]),
        ),
        ingredients: [],
      };
      grouped.set(key, recipe);
    }
    const ingredientName = asText(
      valueFor(row, ["item", "produto", "insumo", "ingrediente", "material"]),
    );
    const ingredientQuantity = valueFor(row, [
      "quantidade ingrediente",
      "qtd ingrediente",
      "quantidade usada",
      "quantidade usada na receita",
      "qtd usada",
      "consumo",
    ]);
    if (ingredientName && ingredientQuantity !== undefined) {
      const ingredientKey = normalize(ingredientName);
      let itemId = itemIds.get(ingredientKey);
      if (!itemId) {
        const item: MarketItem = {
          id: makeId(),
          name: ingredientName,
          unit: "g",
        };
        importedItems.push(item);
        itemIds.set(ingredientKey, item.id);
        itemId = item.id;
      }
      recipe.ingredients.push({
        id: makeId(),
        marketItemId: itemId,
        quantity: asNumber(ingredientQuantity, 0),
      });
    }
  }
  if (!importedItems.length && !grouped.size)
    throw new Error(
      "Não encontrei colunas de insumos ou receitas reconhecíveis.",
    );
  return { market: importedItems, recipes: [...grouped.values()] };
}
