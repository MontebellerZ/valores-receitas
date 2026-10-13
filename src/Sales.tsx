import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Eye, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react'

export type Sale = {
  id: string
  productionId: string
  productionDate: string
  recipeName: string
  date: string
  packages: number
  pricePerPackage: number
  costPerPackage: number
  customer: string
  paid: boolean
  notes: string
}

export type SaleDraft = Pick<Sale, 'productionId' | 'date' | 'packages' | 'pricePerPackage' | 'customer' | 'paid' | 'notes'> & { id?: string }

type SalesProduction = {
  id: string
  date: string
  recipeName: string
  packages: number
  salePrice: number
  expectedSalePrice?: number
}

type Props = {
  productions: SalesProduction[]
  sales: Sale[]
  onSave: (draft: SaleDraft) => string | undefined
  onDelete: (sale: Sale) => void
  onViewProduction: (id: string) => void
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const count = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
const dateLabel = (value: string) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) : 'Sem data'
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const priceText = (value: number) => String(value).replace('.', ',')

function SaleForm({ productions, sales, sale, onSave, onCancel }: Pick<Props, 'productions' | 'sales' | 'onSave'> & { sale?: Sale; onCancel: () => void }) {
  const soldPackages = (id: string) => sales.filter((entry) => entry.productionId === id && entry.id !== sale?.id).reduce((total, entry) => total + entry.packages, 0)
  const firstProduction = productions.find((production) => production.packages > soldPackages(production.id))
  const [productionId, setProductionId] = useState(sale?.productionId ?? firstProduction?.id ?? '')
  const selected = productions.find((production) => production.id === productionId)
  const [date, setDate] = useState(sale?.date ?? today())
  const [packages, setPackages] = useState(String(sale?.packages ?? 1))
  const [price, setPrice] = useState(priceText(sale?.pricePerPackage ?? firstProduction?.expectedSalePrice ?? firstProduction?.salePrice ?? 0))
  const [customer, setCustomer] = useState(sale?.customer ?? '')
  const [paid, setPaid] = useState(sale?.paid ?? true)
  const [notes, setNotes] = useState(sale?.notes ?? '')
  const [error, setError] = useState('')
  const available = selected ? Math.max(0, selected.packages - soldPackages(selected.id)) : 0
  const rawPrice = price.trim().replace(/\s/g, '').replace(/R\$/i, '')
  const parsedPrice = rawPrice ? Number(rawPrice.includes(',') ? rawPrice.replace(/\./g, '').replace(',', '.') : rawPrice) : NaN
  const quantity = Number(packages)
  const validAmount = Number.isInteger(quantity) && quantity > 0 && Number.isFinite(parsedPrice) && parsedPrice >= 0 && Number.isFinite(quantity * parsedPrice)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !date || !validAmount) {
      setError('Selecione uma produção, uma data, uma quantidade inteira positiva e um preço válido.')
      return
    }
    if (quantity > available) {
      setError(`Esta produção tem apenas ${count(available)} pacotes disponíveis.`)
      return
    }
    const message = onSave({ id: sale?.id, productionId, date, packages: quantity, pricePerPackage: parsedPrice, customer: customer.trim(), paid, notes: notes.trim() })
    if (message) setError(message)
    else onCancel()
  }

  return <>
    <button className="text-button detail-back" onClick={onCancel}><ArrowLeft size={17} aria-hidden="true" /> Voltar para vendas</button>
    <section className="welcome-row page-title-row"><div><div className="eyebrow">VENDAS REALIZADAS</div><h1>{sale ? 'Editar venda' : 'Registrar venda'}</h1></div></section>
    <form className="sales-form" onSubmit={submit}>
      <div className="sales-form-fields">
        <label className="field sales-production-field"><span>Produção</span><select required value={productionId} onChange={(event) => {
          const production = productions.find((entry) => entry.id === event.target.value)
          setProductionId(event.target.value)
          if (production) setPrice(priceText(production.expectedSalePrice ?? production.salePrice))
          setError('')
        }}><option value="" disabled>Selecione uma produção</option>{productions.map((production) => <option key={production.id} value={production.id} disabled={production.packages <= soldPackages(production.id)}>{production.recipeName} · {dateLabel(production.date)} · {count(Math.max(0, production.packages - soldPackages(production.id)))} disponíveis</option>)}</select></label>
        <label className="field"><span>Data da venda</span><input type="date" required value={date} min={selected?.date || undefined} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="field"><span>Pacotes vendidos</span><input type="number" required min="1" max={available} step="1" value={packages} onChange={(event) => setPackages(event.target.value)} /><small>{count(available)} disponíveis</small></label>
        <label className="field"><span>Preço real / pacote</span><div className="currency-input"><span>R$</span><input type="text" inputMode="decimal" required value={price} onChange={(event) => setPrice(event.target.value)} /></div></label>
        <label className="field"><span>Cliente (opcional)</span><input value={customer} onChange={(event) => setCustomer(event.target.value)} /></label>
        <label className="sales-paid-field"><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} /> Valor recebido</label>
        <label className="field sales-notes-field"><span>Observações (opcional)</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </div>
      <div className="sales-form-footer"><div><span>Total da venda</span><strong>{validAmount ? money(quantity * parsedPrice) : '—'}</strong></div><div className="sales-form-actions"><button className="button button-secondary" type="button" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit"><Check size={17} aria-hidden="true" /> Salvar venda</button></div></div>
      {error && <p className="sales-error" role="alert">{error}</p>}
    </form>
  </>
}

export default function Sales({ productions, sales, onSave, onDelete, onViewProduction }: Props) {
  const [editing, setEditing] = useState<{ sale?: Sale } | null>(null)
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const soldPackages = (id: string) => sales.filter((sale) => sale.productionId === id).reduce((total, sale) => total + sale.packages, 0)
  const availablePackages = productions.reduce((total, production) => total + Math.max(0, production.packages - soldPackages(production.id)), 0)
  const visibleSales = sales.filter((sale) => (!filter || sale.productionId === filter) && `${sale.recipeName} ${sale.customer} ${sale.notes}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).slice().sort((first, second) => second.date.localeCompare(first.date))
  const totals = sales.reduce((total, sale) => {
    const revenue = sale.packages * sale.pricePerPackage
    return { revenue: total.revenue + revenue, received: total.received + (sale.paid ? revenue : 0), pending: total.pending + (sale.paid ? 0 : revenue), profit: total.profit + revenue - sale.packages * sale.costPerPackage }
  }, { revenue: 0, received: 0, pending: 0, profit: 0 })

  if (editing) return <SaleForm key={editing.sale?.id ?? 'new'} productions={productions} sales={sales} sale={editing.sale} onSave={onSave} onCancel={() => setEditing(null)} />

  return <>
    <section className="welcome-row page-title-row"><div><div className="eyebrow">VENDAS REALIZADAS</div><h1>Vendas</h1><p>{sales.length} vendas registradas · {count(availablePackages)} pacotes disponíveis</p></div><button className="button button-primary" disabled={!availablePackages} onClick={() => setEditing({})}><Plus size={17} aria-hidden="true" /> Registrar venda</button></section>
    <section className="metric-grid" aria-label="Resumo de vendas">
      <article className="metric-card"><div className="metric-top">Faturamento vendido</div><strong>{money(totals.revenue)}</strong><div className="metric-foot">Vendas registradas</div></article>
      <article className="metric-card"><div className="metric-top">Recebido</div><strong>{money(totals.received)}</strong><div className="metric-foot">Valores recebidos</div></article>
      <article className="metric-card"><div className="metric-top">A receber</div><strong>{money(totals.pending)}</strong><div className="metric-foot">Vendas com pagamento pendente</div></article>
      <article className="metric-card"><div className="metric-top">Resultado das vendas</div><strong className={totals.profit < 0 ? 'sales-loss' : undefined}>{money(totals.profit)}</strong><div className="metric-foot">Menos ingredientes dos pacotes vendidos</div></article>
    </section>
    <section className="sales-section" aria-labelledby="sales-stock-title">
      <div className="panel-heading"><h2 id="sales-stock-title">Saldo por produção</h2></div>
      {productions.length ? <div className="table-scroll"><table className="data-table sales-table"><thead><tr><th>Produção</th><th>Produzidos</th><th>Vendidos</th><th>Disponíveis</th><th /></tr></thead><tbody>{productions.slice().sort((first, second) => second.date.localeCompare(first.date)).map((production) => {
        const sold = soldPackages(production.id)
        return <tr key={production.id}><td><strong>{production.recipeName}</strong><small>{dateLabel(production.date)}</small></td><td>{count(production.packages)}</td><td>{count(sold)}</td><td className="price-cell">{count(Math.max(0, production.packages - sold))}</td><td><button className="icon-button" aria-label={`Visualizar produção de ${production.recipeName} em ${production.date}`} title="Visualizar produção" onClick={() => onViewProduction(production.id)}><Eye size={16} aria-hidden="true" /></button></td></tr>
      })}</tbody></table></div> : <div className="empty-inline"><ShoppingBag size={26} aria-hidden="true" /><p>Nenhuma produção disponível para venda.</p></div>}
    </section>
    <section className="sales-section" aria-labelledby="sales-history-title">
      <div className="sales-history-heading"><h2 id="sales-history-title">Histórico de vendas</h2><div className="sales-filters"><select aria-label="Filtrar vendas por produção" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todas as produções</option>{productions.map((production) => <option key={production.id} value={production.id}>{production.recipeName} · {dateLabel(production.date)}</option>)}</select><input aria-label="Buscar vendas" placeholder="Buscar vendas..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
      {visibleSales.length ? <div className="table-scroll"><table className="data-table sales-table"><thead><tr><th>Venda / produção</th><th>Cliente</th><th>Pacotes</th><th>Preço / pacote</th><th>Total</th><th>Pagamento</th><th>Ações</th></tr></thead><tbody>{visibleSales.map((sale) => <tr key={sale.id}><td><strong>{sale.recipeName}</strong><small>Venda: {dateLabel(sale.date)} · produção: {dateLabel(sale.productionDate)}</small>{sale.notes && <small className="sales-notes">{sale.notes}</small>}</td><td>{sale.customer || '—'}</td><td>{count(sale.packages)}</td><td>{money(sale.pricePerPackage)}</td><td className="price-cell">{money(sale.packages * sale.pricePerPackage)}</td><td><span className={`sales-payment ${sale.paid ? 'is-paid' : ''}`}>{sale.paid ? 'Recebido' : 'A receber'}</span></td><td><div className="sales-row-actions"><button className="icon-button" title="Editar venda" aria-label={`Editar venda de ${sale.recipeName} para ${sale.customer || 'cliente não informado'}`} onClick={() => setEditing({ sale })}><Pencil size={16} aria-hidden="true" /></button><button className="icon-button danger-button" title="Excluir venda" aria-label={`Excluir venda de ${sale.recipeName} para ${sale.customer || 'cliente não informado'}`} onClick={() => onDelete(sale)}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr>)}</tbody></table></div> : <div className="empty-inline">{sales.length ? 'Nenhuma venda encontrada para estes filtros.' : 'Nenhuma venda registrada.'}</div>}
    </section>
    {!productions.length && <button className="button button-secondary" onClick={() => onViewProduction('')}>Ir para produção</button>}
  </>
}