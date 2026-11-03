import type { Sale, SaleDraft, SalePointAllocation, SalePointInventory } from "./models";

export function groupInventoryByRecipe(rows: SalePointInventory[], salePointId: string | null) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    if (row.salePointId === salePointId)
      grouped.set(row.recipeName, (grouped.get(row.recipeName) ?? 0) + row.packages);
  }
  return [...grouped].map(([recipeName, packages]) => ({ recipeName, packages }))
    .sort((left, right) => left.recipeName.localeCompare(right.recipeName));
}

export function transferAllocations(
  rows: SalePointInventory[], productionId: string, sourcePointId: string | null,
  destinationPointId: string | null, packages: number, salePointIds: string[],
): SalePointAllocation[] | null {
  const productionRows = rows.filter((row) => row.productionId === productionId);
  const sourcePackages = productionRows.filter((row) => row.salePointId === sourcePointId)
    .reduce((total, row) => total + row.packages, 0);
  if (!Number.isSafeInteger(packages) || packages < 1 || packages > sourcePackages ||
    sourcePointId === destinationPointId ||
    (destinationPointId !== null && !salePointIds.includes(destinationPointId))) return null;
  return salePointIds.map((salePointId) => ({
    salePointId,
    packages: productionRows.filter((row) => row.salePointId === salePointId)
      .reduce((total, row) => total + row.packages, 0) +
      (sourcePointId === salePointId ? -packages : 0) +
      (destinationPointId === salePointId ? packages : 0),
  }));
}

export function canReclassifySale(existing: Sale | undefined, productionId: string, packages: number) {
  return !!existing && (!existing.salePointId || existing.usesUnassignedStock === true) &&
    existing.productionId === productionId && existing.packages === packages;
}

export function locationAvailable(
  inventory: SalePointInventory[], productionId: string, salePointId: string | null,
  existing?: Sale, reservations: SaleDraft[] = [],
) {
  const stock = inventory.filter((row) => row.productionId === productionId && row.salePointId === salePointId)
    .reduce((total, row) => total + row.packages, 0);
  const originalLocation = existing?.usesUnassignedStock ? null : existing?.salePointId ?? null;
  const returned = existing?.productionId === productionId && originalLocation === salePointId
    ? existing.packages : 0;
  const reserved = reservations.filter((row) => row.productionId === productionId && (row.salePointId ?? null) === salePointId)
    .reduce((total, row) => total + (Number.isInteger(row.packages) && row.packages > 0 ? row.packages : 0), 0);
  return Math.max(0, stock + returned - reserved);
}

export function validateAllocations(allocations: SalePointAllocation[], available: number) {
  if (allocations.some((row) => !row.salePointId || !Number.isSafeInteger(row.packages) || row.packages < 0))
    return "Informe quantidades inteiras iguais ou maiores que zero.";
  if (new Set(allocations.map((row) => row.salePointId)).size !== allocations.length)
    return "Cada ponto deve aparecer apenas uma vez.";
  if (allocations.reduce((total, row) => total + row.packages, 0) > available)
    return "A distribuição supera o saldo remanescente da produção.";
}
