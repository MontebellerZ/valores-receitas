export const balance = (revenue: number, cost: number) =>
  Math.abs(revenue - cost) <=
  Number.EPSILON * Math.max(1, Math.abs(revenue), Math.abs(cost))
    ? 0
    : revenue - cost;

export type Period = "week" | "month" | "six-months" | "year" | "all";

export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function periodStart(period: Period, today: Date) {
  if (period === "all") return "";
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  );
  if (period === "week") start.setDate(start.getDate() - 6);
  else {
    const months = period === "month" ? 1 : period === "six-months" ? 6 : 12;
    start.setDate(1);
    start.setMonth(start.getMonth() - months);
    const lastDay = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    start.setDate(Math.min(today.getDate(), lastDay) + 1);
  }
  return dateKey(start);
}
