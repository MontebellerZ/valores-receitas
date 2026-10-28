export type PendingDelete =
  | { kind: "recipe"; id: string; label: string }
  | { kind: "production"; id: string; label: string }
  | { kind: "sale"; id: string; label: string }
  | { kind: "market"; id: string; label: string; ingredientCount: number }
  | { kind: "ingredient"; recipeId: string; id: string; label: string };
