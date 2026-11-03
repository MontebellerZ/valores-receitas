export function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/R\$/i, "");
  const parsed = Number(
    raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw,
  );
  return Number.isFinite(parsed) ? parsed : fallback;
}
