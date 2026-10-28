export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export const moneyInputValue = (value: number) =>
  (Number.isFinite(value) ? value : 0).toFixed(2).replace(".", ",");

export const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`))
    : "Sem data";

export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    value || 0,
  );

export const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
