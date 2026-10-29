import { useId, type ReactNode } from "react";
import type { ProductionDay } from "../../../domain/productionReport";
import { dateLabel, money, number } from "../../../utils/format";
import Panel from "../../ui/Panel";
import styles from "./styles.module.scss";

const WIDTH = 640;
const HEIGHT = 250;
const PAD = { top: 22, right: 16, bottom: 34, left: 58 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
});

const shortDate = (date: string) => date.split("-").reverse().slice(0, 2).join("/");

function niceStep(range: number, count = 4) {
  if (range <= 0) return 1;
  const raw = range / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

function ticks(min: number, max: number) {
  const step = niceStep(max - min);
  const low = Math.floor(min / step) * step;
  const high = Math.max(low + step, Math.ceil(max / step) * step);
  const values: number[] = [];
  for (let value = low; value <= high + step / 2; value += step) values.push(Number(value.toFixed(6)));
  return { low, high, values };
}

/** Rótulos do eixo X espaçados para não se sobreporem. */
const labelEvery = (count: number) => Math.max(1, Math.ceil(count / 8));

function DailyOutflowChart({ days }: { days: ProductionDay[] }) {
  const scale = ticks(0, Math.max(1, ...days.map((day) => day.total)));
  const y = (value: number) => PAD.top + PLOT_H - (value / scale.high) * PLOT_H;
  const band = PLOT_W / days.length;
  const barWidth = Math.min(34, band * 0.64);
  const every = labelEvery(days.length);
  const totals = days.reduce((sum, day) => ({ sold: sum.sold + day.sold, donated: sum.donated + day.donated }), { sold: 0, donated: 0 });
  const busiest = days.reduce((best, day) => (day.total > best.total ? day : best), days[0]);

  return <figure className={styles.chart}>
    <figcaption>
      <h3>Saídas por dia</h3>
      <p>Pacotes vendidos e doados em cada dia, com o total diário.</p>
    </figcaption>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={`Saídas por dia: ${number(totals.sold)} vendido(s) e ${number(totals.donated)} doado(s) em ${days.length} dia(s). Maior saída: ${number(busiest.total)} pacote(s) em ${dateLabel(busiest.date)}.`}>
      {scale.values.map((value) => <g key={value}>
        <line className={styles.grid} x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} />
        <text className={styles.axis} x={PAD.left - 8} y={y(value) + 4} textAnchor="end">{number(value)}</text>
      </g>)}
      {days.map((day, index) => {
        const x = PAD.left + index * band + (band - barWidth) / 2;
        const soldTop = y(day.sold);
        const totalTop = y(day.total);
        return <g key={day.date}>
          <title>{`${dateLabel(day.date)}: ${number(day.sold)} vendido(s), ${number(day.donated)} doado(s), total ${number(day.total)}`}</title>
          {day.sold > 0 && <rect className={styles.sold} x={x} width={barWidth} y={soldTop} height={y(0) - soldTop} rx={3} />}
          {day.donated > 0 && <rect className={styles.donated} x={x} width={barWidth} y={totalTop} height={soldTop - totalTop} rx={3} />}
          {day.total > 0 && band >= 14 && <text className={styles.value} x={x + barWidth / 2} y={totalTop - 6} textAnchor="middle">{number(day.total)}</text>}
          {index % every === 0 && <text className={styles.axis} x={x + barWidth / 2} y={HEIGHT - PAD.bottom + 18} textAnchor="middle">{shortDate(day.date)}</text>}
        </g>;
      })}
      <line className={styles.baseline} x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} />
    </svg>
    <ul className={styles.legend}>
      <li><span className={[styles.swatch, styles["swatch-sold"]].join(" ")} aria-hidden="true" />Vendidos <strong>{number(totals.sold)}</strong></li>
      <li><span className={[styles.swatch, styles["swatch-donated"]].join(" ")} aria-hidden="true" />Doados <strong>{number(totals.donated)}</strong></li>
    </ul>
  </figure>;
}

function ResultEvolutionChart({ days, cost, productionDate, includeStart }: {
  days: ProductionDay[]; cost: number; productionDate: string; includeStart: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const points = [
    ...(includeStart ? [{ date: productionDate || days[0].date, result: -cost, start: true }] : []),
    ...days.map((day) => ({ ...day, result: day.cumulativeRevenue - cost, start: false })),
  ];
  const values = points.map((point) => point.result);
  const scale = ticks(Math.min(0, ...values), Math.max(0, ...values));
  const y = (value: number) => PAD.top + PLOT_H - ((value - scale.low) / (scale.high - scale.low)) * PLOT_H;
  const x = (index: number) => PAD.left + (points.length > 1 ? (index / (points.length - 1)) * PLOT_W : PLOT_W / 2);
  const zero = y(0);
  const zeroOffset = Math.min(1, Math.max(0, (zero - PAD.top) / PLOT_H));
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.result).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${zero.toFixed(1)} L${x(0).toFixed(1)},${zero.toFixed(1)} Z`;
  // Only a crossing inside the visible points has a date; an earlier page may already have recovered the cost.
  const breakEven = points.findIndex((point, index) => index > 0 && !point.start && point.result >= 0 && points[index - 1].result < 0);
  const final = points[points.length - 1].result;
  const every = labelEvery(points.length);
  const recovery = breakEven > 0 ? ` Custo recuperado em ${dateLabel(points[breakEven].date)}.`
    : final < 0 ? " O custo ainda não foi recuperado."
      : includeStart ? " A produção não teve custo a recuperar." : " Custo recuperado antes deste período.";

  return <figure className={styles.chart}>
    <figcaption>
      <h3>Evolução do resultado</h3>
      <p>Começa no custo da produção e sobe a cada dia conforme o faturamento das vendas.</p>
    </figcaption>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={`Evolução do resultado: começa em ${money(points[0].result)} e chega a ${money(final)}.${recovery}`}>
      <defs>
        <linearGradient id={`${gradientId}-line`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={PAD.top} y2={PAD.top + PLOT_H}>
          <stop offset={zeroOffset} stopColor="#3f7a59" />
          <stop offset={zeroOffset} stopColor="#c46f5f" />
        </linearGradient>
        <linearGradient id={`${gradientId}-area`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={PAD.top} y2={PAD.top + PLOT_H}>
          <stop offset={zeroOffset} stopColor="#3f7a59" stopOpacity="0.16" />
          <stop offset={zeroOffset} stopColor="#c46f5f" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      {scale.values.map((value) => <g key={value}>
        <line className={styles.grid} x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} />
        <text className={styles.axis} x={PAD.left - 8} y={y(value) + 4} textAnchor="end">{compactMoney.format(value)}</text>
      </g>)}
      <path d={area} fill={`url(#${gradientId}-area)`} />
      <line className={styles.zero} x1={PAD.left} x2={WIDTH - PAD.right} y1={zero} y2={zero} />
      <path className={styles.line} d={path} stroke={`url(#${gradientId}-line)`} />
      {points.map((point, index) => <g key={`${point.date}-${index}`}>
        <title>{`${point.start ? "Produção" : dateLabel(point.date)}: ${money(point.result)}`}</title>
        <circle className={point.result < 0 ? styles["point-negative"] : styles["point-positive"]}
          cx={x(index)} cy={y(point.result)} r={index === breakEven ? 5.5 : points.length > 40 ? 2.5 : 3.5} />
        {index % every === 0 && <text className={styles.axis} x={x(index)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle">
          {point.start ? "Início" : shortDate(point.date)}
        </text>}
      </g>)}
      {breakEven > 0 && <text className={styles.marker} x={x(breakEven)} y={y(points[breakEven].result) - 11}
        textAnchor={x(breakEven) > WIDTH - 110 ? "end" : "middle"}>Custo recuperado</text>}
    </svg>
    <ul className={styles.legend}>
      <li>{includeStart ? "Início" : "Início da página"} <strong className={points[0].result < 0 ? styles.negative : styles.positive}>{money(points[0].result)}</strong></li>
      <li>{includeStart ? "Atual" : "Fim da página"} <strong className={final < 0 ? styles.negative : styles.positive}>{money(final)}</strong></li>
    </ul>
  </figure>;
}

/** Charts of one page of the daily report; `pagination` navigates between pages of days. */
export default function ProductionCharts({ days, cost, productionDate, includeStart = true, status = "ready", pagination }: {
  days: ProductionDay[];
  cost: number;
  productionDate: string;
  /** Whether this page contains the first sale day, so the line starts at the production cost. */
  includeStart?: boolean;
  status?: "loading" | "ready" | "error";
  pagination?: ReactNode;
}) {
  return <Panel title="Evolução das vendas" description="Como os pacotes saíram e como o resultado da produção evoluiu dia a dia."
    aria-busy={status === "loading"}>
    {status === "error" ? <p className={styles.empty} role="alert">Não foi possível carregar o relatório diário.</p>
      : days.length ? <div className={styles.charts}>
      <DailyOutflowChart days={days} />
      <ResultEvolutionChart days={days} cost={cost} productionDate={productionDate} includeStart={includeStart} />
    </div> : status === "ready" && <p className={styles.empty}>Os gráficos aparecem assim que a primeira venda ou doação desta produção for registrada.</p>}
    {pagination}
  </Panel>;
}
