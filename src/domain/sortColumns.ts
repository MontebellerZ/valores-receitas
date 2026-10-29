/**
 * Table column index → API `sortBy` field for every server-sorted listing.
 * Only fields accepted by the `/api/query` endpoints are listed; other columns are not sortable.
 */
export const realizedSalesSortColumns = { 0: "date", 1: "customer", 2: "packages", 3: "pricePerPackage", 4: "total", 6: "paid" };
export const marketSortColumns = { 0: "name", 1: "unit" };
/**
 * Sold, price, revenue and result of the overview mix period sales with projections for productions
 * without period sales, so only columns with an equivalent API field are sortable.
 */
export const overviewBalanceSortColumns = {
  0: "recipeName", 1: "periodSold", 2: "available", 3: "periodPrice", 4: "periodRevenue", 5: "periodResult",
};
export const overviewSalesSortColumns = { 0: "recipeName", 1: "customer", 2: "packages", 3: "total", 4: "paid" };
export const consumptionSortColumns = { 0: "itemName", 1: "entryDate", 2: "quantity", 3: "cost" };
export const balanceSortColumns = { 0: "recipeName", 1: "packages", 2: "sold", 3: "lostPackages", 4: "available" };
export const salesSortColumns = { 0: "recipeName", 1: "customer", 2: "packages", 3: "pricePerPackage", 4: "total", 5: "paid" };
export const stockSortColumns = { 0: "itemName", 1: "entryOrder", 2: "packageQty", 3: "packagePrice", 4: "remainingQty" };
export const recipeIngredientSortColumns = { 0: "name", 1: "quantity", 2: "unit" };
