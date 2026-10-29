import type {
  CalculatedProduction,
  Production,
  Sale,
  SaleDraft,
} from "./models";
import { calculateProduction, remainingPackages } from "./calculations";
import { makeId, number } from "../utils/format";

/** Agregados das vendas de uma produção, calculados pelo servidor. */
export type ProductionSalesStats = {
  salesCount: number;
  soldPackages: number;
  firstSaleDate: string | null;
};

export function validateProductionUpdate(
  production: Production,
  patch: Partial<Production>,
  stats: ProductionSalesStats,
) {
  if (production.quantity > 0 &&
      ((patch.recipeId !== undefined && patch.recipeId !== production.recipeId) ||
       (patch.quantity !== undefined && patch.quantity !== production.quantity))) {
    return "Receita e quantidade são imutáveis após salvar a produção e consumir o estoque.";
  }
  const sold = stats.soldPackages;
  if (
    stats.salesCount > 0 &&
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
  if (patch.date && stats.firstSaleDate && stats.firstSaleDate < patch.date) {
    return "A data da produção não pode ser posterior às vendas já registradas.";
  }
}

type SaleResult =
  { sale: Sale; error?: never } | { sale?: never; error: string };

/** Produção candidata a venda com o total já vendido por todas as vendas gravadas. */
export type SaleTarget = { production: CalculatedProduction; soldPackages: number };

export function prepareSales(
  drafts: SaleDraft[],
  targets: SaleTarget[],
): { sales: Sale[]; error?: never } | { sales?: never; error: string } {
  if (drafts.length === 0)
    return { error: "Adicione pelo menos uma venda ao carrinho." };
  const reserved = new Map<string, number>();
  const prepared: Sale[] = [];
  for (const [index, draft] of drafts.entries()) {
    if (draft.id)
      return { error: "O carrinho permite apenas cadastrar novas vendas." };
    const target = targets.find((entry) => entry.production.id === draft.productionId);
    const sold = (target?.soldPackages ?? 0) + (reserved.get(draft.productionId) ?? 0);
    const result = prepareSale(draft, target?.production, sold);
    if (result.error !== undefined)
      return { error: `Venda ${index + 1}: ${result.error}` };
    reserved.set(draft.productionId, (reserved.get(draft.productionId) ?? 0) + result.sale.packages);
    prepared.push(result.sale);
  }
  return { sales: prepared };
}

/**
 * Valida uma venda contra a produção escolhida. `soldByOthers` é o total de pacotes
 * já registrados na produção sem contar a própria venda em edição.
 */
export function prepareSale(
  draft: SaleDraft,
  production: CalculatedProduction | undefined | null,
  soldByOthers: number,
  existing?: Sale | null,
): SaleResult {
  if (!production || production.id !== draft.productionId)
    return { error: "A produção selecionada não está disponível." };
  if (production.quantity <= 0)
    return { error: "Salve a produção e consuma o estoque antes de registrar vendas." };
  if (draft.id && (!existing || existing.id !== draft.id))
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
  const available = remainingPackages(production, Math.max(0, soldByOthers));
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