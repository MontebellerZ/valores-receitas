export const paths = {
  overview: "/",
  login: "/login",
  register: "/cadastro",
  recipes: "/receitas",
  recipePattern: "/receitas/:recipeId",
  recipe: (id: string) => `/receitas/${encodeURIComponent(id)}`,
  productions: "/producao",
  productionPattern: "/producao/:productionId",
  production: (id: string) => `/producao/${encodeURIComponent(id)}`,
  market: "/insumos",
  stock: "/estoque",
  sales: "/vendas",
  saleNew: "/vendas/nova",
  saleEditPattern: "/vendas/:saleId/editar",
  saleEdit: (id: string) => `/vendas/${encodeURIComponent(id)}/editar`,
} as const;

export function getLoginDestination(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return paths.overview;
  }
  const pathname = value.split(/[?#]/)[0];
  return pathname === paths.login || pathname === paths.register
    ? paths.overview
    : value;
}
