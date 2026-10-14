import { ArrowRight, Eye, ShoppingBag } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Sale } from './Sales'
import logoVertical from './assets/brand/conta-de-chef-vertical.png'

type OverviewProduction = {
  id: string
  date: string
  recipeName: string
  packages: number
  produced: number
  losses: number
  cost: number
  costPerPackage: number
  salePrice: number
  revenue: number
  profit: number
  expectedSalePrice?: number
}

type Props = {
  productions: OverviewProduction[]
  sales: Sale[]
  recipeCount: number
  marketCount: number
  importAction: ReactNode
  onViewSales: () => void
  onViewProduction: (id?: string) => void
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const count = (value: number, digits = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)
const dateLabel = (value: string) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) : 'Sem data'
const balance = (revenue: number, cost: number) => Math.abs(revenue - cost) <= Number.EPSILON * Math.max(1, Math.abs(revenue), Math.abs(cost)) ? 0 : revenue - cost

type Period = 'week' | 'month' | 'six-months' | 'year' | 'all'

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function periodStart(period: Period, today: Date) {
  if (period === 'all') return ''
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  if (period === 'week') start.setDate(start.getDate() - 6)
  else {
    const months = period === 'month' ? 1 : period === 'six-months' ? 6 : 12
    start.setDate(1)
    start.setMonth(start.getMonth() - months)
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    start.setDate(Math.min(today.getDate(), lastDay) + 1)
  }
  return dateKey(start)
}

function summarizeSales(sales: Sale[]) {
  return sales.reduce((total, sale) => {
    const revenue = sale.packages * sale.pricePerPackage
    return {
      packages: total.packages + sale.packages,
      revenue: total.revenue + revenue,
      received: total.received + (sale.paid ? revenue : 0),
      pending: total.pending + (sale.paid ? 0 : revenue),
      cost: total.cost + sale.packages * sale.costPerPackage,
    }
  }, { packages: 0, revenue: 0, received: 0, pending: 0, cost: 0 })
}

export default function Overview({ productions, sales, recipeCount, marketCount, importAction, onViewSales, onViewProduction }: Props) {
  const [period, setPeriod] = useState<Period>('all')
  const today = new Date()
  const end = dateKey(today)
  const start = periodStart(period, today)
  const inPeriod = (date: string) => date ? (!start || date >= start) && date <= end : period === 'all'
  const periodSales = sales.filter((sale) => inPeriod(sale.date))
  const periodProductions = productions.filter((production) => inPeriod(production.date))
  const actual = summarizeSales(periodSales)
  const actualProfit = balance(actual.revenue, actual.cost)
  const rows = periodProductions.map((production) => {
    const linkedSales = periodSales.filter((sale) => sale.productionId === production.id)
    const realized = summarizeSales(linkedSales)
    const soldPackages = sales.filter((sale) => sale.productionId === production.id).reduce((total, sale) => total + sale.packages, 0)
    const price = production.expectedSalePrice ?? production.salePrice
    const available = Math.max(0, production.packages - soldPackages)
    return { ...production, realized, soldPackages, hasSales: linkedSales.length > 0, price, available, remainingRevenue: price * available, remainingCost: production.costPerPackage * available }
  }).sort((first, second) => second.date.localeCompare(first.date))
  const planning = rows.reduce((total, production) => ({
    packages: total.packages + production.packages,
    soldPackages: total.soldPackages + production.soldPackages,
    available: total.available + production.available,
    cost: total.cost + production.cost,
    losses: total.losses + production.losses,
    remainingRevenue: total.remainingRevenue + production.remainingRevenue,
    remainingCost: total.remainingCost + production.remainingCost,
    expectedRevenue: total.expectedRevenue + production.price * production.packages,
    referenceRevenue: total.referenceRevenue + production.revenue,
    referenceProfit: total.referenceProfit + production.profit,
  }), { packages: 0, soldPackages: 0, available: 0, cost: 0, losses: 0, remainingRevenue: 0, remainingCost: 0, expectedRevenue: 0, referenceRevenue: 0, referenceProfit: 0 })
  const remainingProfit = balance(planning.remainingRevenue, planning.remainingCost)
  const recentSales = periodSales.slice().sort((first, second) => second.date.localeCompare(first.date) || second.id.localeCompare(first.id)).slice(0, 5)
  const soldPercent = planning.packages > 0 ? Math.min(100, planning.soldPackages / planning.packages * 100) : 0

  return <div className="overview-dashboard">
    <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> SEU NEGÓCIO, EM NÚMEROS</div><h1>Visão geral</h1><p>{periodProductions.length} produções · {periodSales.length} vendas · {recipeCount} receitas · {marketCount} itens de mercado</p></div><div className="welcome-actions">{importAction}<button className="button button-primary" onClick={onViewSales}><ShoppingBag size={17} aria-hidden="true" /> Vendas</button></div></section>
    <div className="overview-period-filter"><label><span>Período</span><select value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="week">Última semana</option><option value="month">Último mês</option><option value="six-months">Últimos 6 meses</option><option value="year">Último ano</option><option value="all">Desde sempre</option></select></label><span>{start ? `${dateLabel(start)} a ${dateLabel(end)}` : `Até ${dateLabel(end)}`}</span></div>

    <section className="metric-grid" aria-label="Resultados reais">
      <article className="metric-card"><div className="metric-top">Faturamento vendido</div><strong>{money(actual.revenue)}</strong><div className="metric-foot">{count(actual.packages)} pacotes vendidos</div></article>
      <article className="metric-card"><div className="metric-top">Recebido</div><strong>{money(actual.received)}</strong><div className="metric-foot">Valores recebidos</div></article>
      <article className="metric-card"><div className="metric-top">A receber</div><strong>{money(actual.pending)}</strong><div className="metric-foot">{periodSales.filter((sale) => !sale.paid).length} vendas pendentes</div></article>
      <article className="metric-card"><div className="metric-top">Resultado das vendas</div><strong className={actualProfit < 0 ? 'sales-loss' : undefined}>{money(actualProfit)}</strong><div className="metric-foot">Ingredientes vendidos: {money(actual.cost)}</div></article>
    </section>

    <section className="overview-stock-band" aria-label="Produção e estoque">
      <div><span>Pacotes produzidos</span><strong>{count(planning.packages)}</strong></div><div><span>Pacotes disponíveis</span><strong>{count(planning.available)}</strong></div><div><span>Custo total registrado</span><strong>{money(planning.cost)}</strong></div><div><span>Perdas registradas</span><strong>{count(planning.losses)} un.</strong></div>
    </section>

    <div className="overview-summary-grid">
      <section className="overview-section" aria-labelledby="overview-performance-title">
        <div className="panel-heading"><h2 id="overview-performance-title">Vendas por produção</h2><button className="inline-link" onClick={() => onViewProduction()}>Ver produção <ArrowRight size={14} aria-hidden="true" /></button></div>
        {rows.length ? <div className="overview-production-progress">{rows.slice(0, 6).map((production) => {
          const percent = production.packages > 0 ? Math.min(100, production.realized.packages / production.packages * 100) : 0
          return <div className="overview-progress-row" key={production.id}><div className="overview-progress-heading"><div><strong>{production.recipeName}</strong><small>{dateLabel(production.date)}</small></div><span>{count(production.realized.packages)} / {count(production.packages)} pacotes</span></div><progress aria-label={`Pacotes vendidos de ${production.recipeName} em ${production.date}`} value={production.realized.packages} max={Math.max(1, production.packages)} /><div className="overview-progress-footer"><span>{money(production.realized.revenue)} vendidos</span><span>{count(percent, 1)}% vendido</span></div></div>
        })}</div> : <div className="empty-inline overview-empty-brand"><img src={logoVertical} alt="" width="548" height="309" /><p>Nenhuma produção registrada.</p></div>}
      </section>

      <section className="overview-section" aria-labelledby="overview-planning-title">
        <div className="panel-heading"><h2 id="overview-planning-title">Planejamento do estoque</h2><span className="round-icon"><ShoppingBag size={17} aria-hidden="true" /></span></div>
        <dl className="overview-planning-values"><div><dt>Potencial do estoque restante</dt><dd>{money(planning.remainingRevenue)}</dd></div><div><dt>Resultado potencial restante</dt><dd className={remainingProfit < 0 ? 'text-negative' : undefined}>{money(remainingProfit)}</dd></div><div><dt>Vendido + potencial restante</dt><dd>{money(actual.revenue + planning.remainingRevenue)}</dd></div><div><dt>Resultado vendido + potencial</dt><dd className={actualProfit + remainingProfit < 0 ? 'text-negative' : undefined}>{money(actualProfit + remainingProfit)}</dd></div></dl>
        <div className="overview-stock-progress"><span>{count(soldPercent, 1)}% dos pacotes dessas produções já vendidos</span><progress aria-label="Percentual de pacotes vendidos" value={planning.soldPackages} max={Math.max(1, planning.packages)} /></div>
        <details className="overview-reference"><summary>Referências do planejamento</summary><dl><div><dt>Venda esperada de toda a produção</dt><dd>{money(planning.expectedRevenue)}</dd></div><div><dt>Faturamento original por acréscimo</dt><dd>{money(planning.referenceRevenue)}</dd></div><div><dt>Lucro original por acréscimo</dt><dd>{money(planning.referenceProfit)}</dd></div></dl></details>
      </section>
    </div>

    <section className="overview-section" aria-labelledby="overview-productions-title">
      <div className="panel-heading"><h2 id="overview-productions-title">Resumo das produções</h2><button className="inline-link" onClick={() => onViewProduction()}>Ver todas <ArrowRight size={14} aria-hidden="true" /></button></div>
      {rows.length ? <div className="table-scroll"><table className="data-table sales-table overview-production-table"><thead><tr><th>Produção</th><th>Vendidos</th><th>Disponíveis</th><th>Preço / pacote</th><th>Faturamento</th><th>Resultado</th><th /></tr></thead><tbody>{rows.slice(0, 6).map((production) => {
        const source = production.hasSales ? 'Realizado' : production.expectedSalePrice !== undefined ? 'Esperado' : 'Previsto'
        const revenue = production.hasSales ? production.realized.revenue : production.price * production.packages
        const cost = production.hasSales ? production.realized.cost : production.cost
        const result = balance(revenue, cost)
        return <tr key={production.id}><td><strong>{production.recipeName}</strong><small>{dateLabel(production.date)}</small></td><td>{count(production.realized.packages)}</td><td>{count(production.available)}</td><td>{production.hasSales ? production.realized.packages > 0 ? money(production.realized.revenue / production.realized.packages) : '—' : money(production.price)}<small>{production.hasSales ? 'Média realizada' : production.expectedSalePrice !== undefined ? 'Preço desejado' : 'Preço sugerido'}</small></td><td>{money(revenue)}<small>{source}</small></td><td><span className={result < 0 ? 'text-negative' : undefined}>{production.hasSales || production.packages > 0 ? money(result) : '—'}</span><small>{source}</small></td><td><button className="icon-button" title="Visualizar produção" aria-label={`Visualizar produção de ${production.recipeName} em ${production.date}`} onClick={() => onViewProduction(production.id)}><Eye size={16} aria-hidden="true" /></button></td></tr>
      })}</tbody></table></div> : <div className="empty-inline">Nenhuma produção registrada.</div>}
    </section>

    <section className="overview-section" aria-labelledby="overview-sales-title">
      <div className="panel-heading"><h2 id="overview-sales-title">Vendas recentes</h2><button className="inline-link" onClick={onViewSales}>Ver vendas <ArrowRight size={14} aria-hidden="true" /></button></div>
      {recentSales.length ? <div className="table-scroll"><table className="data-table sales-table"><thead><tr><th>Venda</th><th>Cliente</th><th>Pacotes</th><th>Total</th><th>Pagamento</th></tr></thead><tbody>{recentSales.map((sale) => <tr key={sale.id}><td><strong>{sale.recipeName}</strong><small>{dateLabel(sale.date)}</small></td><td>{sale.customer || '—'}</td><td>{count(sale.packages)}</td><td>{money(sale.packages * sale.pricePerPackage)}</td><td><span className={`sales-payment ${sale.paid ? 'is-paid' : ''}`}>{sale.paid ? 'Recebido' : 'A receber'}</span></td></tr>)}</tbody></table></div> : <div className="empty-inline">Nenhuma venda registrada.</div>}
    </section>
  </div>
}