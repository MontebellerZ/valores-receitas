export type SheetRow = Record<string, unknown>;

export function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function valueFor(row: SheetRow, aliases: string[]) {
  const key = Object.keys(row).find((column) =>
    aliases.includes(normalize(column)),
  );
  return key ? row[key] : undefined;
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

export function asText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}
