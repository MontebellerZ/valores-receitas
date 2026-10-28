import type {
  CalculatedProduction,
  Production,
  Sale,
  SaleDraft,
} from "./models";
import { calculateProduction, remainingPackages } from "./calculations";
import { makeId, number } from "../utils/format";

export function validateProductionUpdate(
  production: Production,
  patch: Partial<Production>,
  sales: Sale[],
) {
  if (production.quantity > 0 &&
      ((patch.recipeId !== undefined && patch.recipeId !== production.recipeId) ||
       (patch.quantity !== undefined && patch.quantity !== production.quantity))) {
    return "Receita e quantidade são imutáveis após salvar a produção e consumir o estoque.";
  }
  const linkedSales = sales.filter(
    (sale) => sale.productionId === production.id,
  );
  const sold = linkedSales.reduce((total, sale) => total + sale.packages, 0);
  if (
    linkedSales.length &&
    ((patch.recipeId !== undefined && patch.recipeId !== production.recipeId) ||
      (patch.packageQty !== undefined &&
        patch.packageQty !== production.packageQty))
  ) {
    return "Esta produção já possui vendas. A receita e a quantidade por pacote não podem ser alteradas.";
  }
  const next = calculateProduction({ ...production, ...patch });
  if (next.packages < sold) {
    return `Esta produção já tem ${number(sold)} pacotes vendidos. O rendimento não pode ficar abaixo desse total.`;
  }
  const lost = next.lostPackages ?? 0;
  if (!Number.isInteger(lost) || lost < 0) {
    return "Informe uma quantidade inteira de pacotes perdidos, igual ou maior que zero.";
  }
  if (next.packages - lost < sold) {
    return `Esta produção tem ${number(next.packages)} pacotes e ${number(sold)} já foram vendidos. No máximo ${number(next.packages - sold)} pacotes podem ser marcados como perdidos.`;
  }
  if (patch.date && linkedSales.some((sale) => sale.date < patch.date!)) {
    return "A data da produção não pode ser posterior às vendas já registradas.";
  }
}

type SaleResult =
  { sale: Sale; error?: never } | { sale?: never; error: string };

export function prepareSales(
  drafts: SaleDraft[],
  productions: CalculatedProduction[],
  sales: Sale[],
): { sales: Sale[]; error?: never } | { sales?: never; error: string } {
  if (drafts.length === 0)
    return { error: "Adicione pelo menos uma venda ao carrinho." };
  const prepared: Sale[] = [];
  for (const [index, draft] of drafts.entries()) {
    if (draft.id)
      return { error: "O carrinho permite apenas cadastrar novas vendas." };
    const result = prepareSale(draft, productions, [...sales, ...prepared]);
    if (result.error !== undefined)
      return { error: `Venda ${index + 1}: ${result.error}` };
    prepared.push(result.sale);
  }
  return { sales: prepared };
}

export function prepareSale(
  draft: SaleDraft,
  productions: CalculatedProduction[],
  sales: Sale[],
): SaleResult {
  const production = productions.find(
    (entry) => entry.id === draft.productionId,
  );
  if (!production)
    return { error: "A produção selecionada não está disponível." };
  if (production.quantity <= 0)
    return { error: "Salve a produção e consuma o estoque antes de registrar vendas." };
  const existing = draft.id
    ? sales.find((sale) => sale.id === draft.id)
    : undefined;
  if (draft.id && !existing)
    return { error: "Esta venda não está mais disponível." };
  if (
    !Number.isInteger(draft.packages) ||
    draft.packages <= 0 ||
    !Number.isFinite(draft.pricePerPackage) ||
    draft.pricePerPackage < 0 ||
    !Number.isFinite(draft.packages * draft.pricePerPackage)
  ) {
    return { error: "Informe uma quantidade e um preço válidos." };
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(new Date(`${draft.date}T12:00:00`).getTime()) ||
    (production.date && draft.date < production.date)
  ) {
    return { error: "A data da venda deve ser igual ou posterior à produção." };
  }
  const sold = sales
    .filter(
      (sale) => sale.productionId === production.id && sale.id !== draft.id,
    )
    .reduce((total, sale) => total + sale.packages, 0);
  const available = remainingPackages(production, sold);
  if (draft.packages > available) {
    return {
      error: `Esta produção tem apenas ${number(available)} pacotes disponíveis.`,
    };
  }
  const sameProduction = existing?.productionId === production.id;
  return {
    sale: {
      ...draft,
      ...(draft.donated
        ? { donated: true, paid: true, pricePerPackage: 0 }
        : { donated: false }),
      id: existing?.id ?? makeId(),
      recipeName: sameProduction ? existing.recipeName : production.recipeName,
      productionDate: sameProduction
        ? existing.productionDate
        : production.date,
      costPerPackage: sameProduction
        ? existing.costPerPackage
        : production.costPerPackage,
    },
  };
}
