import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Eye, ShoppingBag } from 'lucide-react'
import * as XLSX from 'xlsx'
import Sales, { type Sale, type SaleDraft } from './Sales'
import './App.css'

type MarketItem = {
  id: string
  name: string
  unit: string
  packageQty: number
  packagePrice: number
}

type Ingredient = { id: string; marketItemId: string; quantity: number }
type Recipe = {
  id: string
  name: string
  category: string
  yield: number
  hoursPerBatch: number
  ingredients: Ingredient[]
}
type Production = {
  id: string
  date: string
  recipeId: string
  recipeName: string
  quantity: number
  actualYield: number
  losses: number
  margin: number
  packageQty: number
  yieldPerBatch: number
  ingredientCostPerBatch: number
  expectedSalePrice?: number
}
type Page = 'overview' | 'recipes' | 'recipe-detail' | 'production' | 'production-detail' | 'market' | 'sales'
type PendingDelete =
  | { kind: 'recipe'; id: string; label: string }
  | { kind: 'production'; id: string; label: string }
  | { kind: 'sale'; id: string; label: string }
  | { kind: 'market'; id: string; label: string; ingredientCount: number }
  | { kind: 'ingredient'; recipeId: string; id: string; label: string }
type CalculatedProduction = Production & {
  cost: number
  produced: number
  packages: number
  costPerPackage: number
  salePrice: number
  revenue: number
  profit: number
}

type SheetRow = Record<string, unknown>

const STORAGE_KEY = 'doce-controle-v1'

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
const moneyInputValue = (value: number) => (Number.isFinite(value) ? value : 0).toFixed(2).replace('.', ',')
const number = (value: number, digits = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value || 0)
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const localToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const unitCost = (item: MarketItem) => item.packageQty > 0 ? item.packagePrice / item.packageQty : 0

function recipeCostPerBatch(recipe: Recipe, market: MarketItem[]) {
  return recipe.ingredients.reduce((total, ingredient) => {
    const item = market.find((entry) => entry.id === ingredient.marketItemId)
    return total + (item ? unitCost(item) * ingredient.quantity : 0)
  }, 0)
}

function calculateProduction(production: Production): CalculatedProduction {
  const cost = production.ingredientCostPerBatch * production.quantity
  const produced = Math.max(0, production.actualYield - production.losses)
  const packages = production.packageQty > 0 ? Math.floor(produced / production.packageQty) : 0
  const costPerPackage = packages > 0 ? cost / packages : 0
  const markupPercent = Math.max(production.margin, 0)
  const salePrice = costPerPackage > 0 ? costPerPackage * (1 + markupPercent / 100) : 0
  const revenue = salePrice * packages
  const profit = revenue - cost
  return { ...production, cost, produced, packages, costPerPackage, salePrice, revenue, profit }
}

function readSavedData(): { market: MarketItem[]; recipes: Recipe[]; productions: Production[]; sales: Sale[] } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as { market?: MarketItem[]; recipes?: Array<Recipe & Partial<{ quantity: number; losses: number; margin: number; packageQty: number }>>; productions?: Production[]; sales?: Sale[] }
      if (Array.isArray(parsed.market) && Array.isArray(parsed.recipes)) {
        const market = parsed.market.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'category')) as MarketItem)
        const recipes: Recipe[] = parsed.recipes.map((recipe) => ({
          id: recipe.id,
          name: recipe.name ?? '',
          category: recipe.category ?? '',
          yield: Number(recipe.yield) || 0,
          hoursPerBatch: Number(recipe.hoursPerBatch) || 0,
          ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
        }))
        const productions: Production[] = Array.isArray(parsed.productions) ? parsed.productions.map((production) => ({
          ...production,
          actualYield: Number.isFinite(production.actualYield) ? production.actualYield : (Number(production.yieldPerBatch) || 0) * (Number(production.quantity) || 0),
          expectedSalePrice: typeof production.expectedSalePrice === 'number' && Number.isFinite(production.expectedSalePrice) && production.expectedSalePrice >= 0 ? production.expectedSalePrice : undefined,
        })) : parsed.recipes.flatMap((oldRecipe) => {
          if (!('quantity' in oldRecipe) || !Number(oldRecipe.quantity)) return []
          const recipe = recipes.find((entry) => entry.id === oldRecipe.id)
          if (!recipe) return []
          return [{
            id: makeId(), date: localToday(), recipeId: recipe.id, recipeName: recipe.name,
            quantity: Number(oldRecipe.quantity) || 0, actualYield: recipe.yield * (Number(oldRecipe.quantity) || 0), losses: Number(oldRecipe.losses) || 0,
            margin: Number(oldRecipe.margin) || 0, packageQty: Number(oldRecipe.packageQty) || 1,
            yieldPerBatch: recipe.yield, ingredientCostPerBatch: recipeCostPerBatch(recipe, market),
          }]
        })
        const sales = Array.isArray(parsed.sales) ? parsed.sales.filter((sale) => sale && typeof sale.id === 'string' && typeof sale.productionId === 'string' && typeof sale.recipeName === 'string' && typeof sale.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sale.date) && Number.isFinite(new Date(`${sale.date}T12:00:00`).getTime()) && Number.isInteger(sale.packages) && sale.packages > 0 && Number.isFinite(sale.pricePerPackage) && sale.pricePerPackage >= 0 && Number.isFinite(sale.costPerPackage) && sale.costPerPackage >= 0).map((sale) => ({ ...sale, customer: sale.customer ?? '', notes: sale.notes ?? '', paid: sale.paid === true, productionDate: sale.productionDate ?? '' })) : []
        return { market, recipes, productions, sales }
      }
    }
  } catch {
    // Dados inválidos são ignorados; sem dados salvos, a aplicação inicia vazia.
  }
  return { market: [], recipes: [], productions: [], sales: [] }
}

function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
function valueFor(row: SheetRow, aliases: string[]) {
  const key = Object.keys(row).find((column) => aliases.includes(normalize(column)))
  return key ? row[key] : undefined
}
function asNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value ?? '').replace(/\s/g, '').replace(/R\$/i, '')
  const parsed = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw)
  return Number.isFinite(parsed) ? parsed : fallback
}
function asText(value: unknown, fallback = '') { return String(value ?? fallback).trim() }

function Icon({ name, size = 18 }: { name: 'overview' | 'recipe' | 'market' | 'upload' | 'plus' | 'trash' | 'download' | 'arrow' | 'check' | 'package' | 'chart' | 'wallet' | 'search' | 'close'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    recipe: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" /><path d="M4 5.5V21m4-13h8m-8 4h8" /></>,
    market: <><path d="M3 3h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 7H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M4 16v4h16v-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    trash: <><path d="M4 7h16m-10 4v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
    download: <><path d="M12 4v12m-4-4 4 4 4-4" /><path d="M4 18v3h16v-3" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    package: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
    chart: <><path d="M4 19V5m0 14h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 8h18m-5 6h2M7 5V3h11" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function SearchableMarketSelect({
  options,
  value,
  onChange,
}: {
  options: MarketItem[]
  value: string
  onChange: (value: string) => void
}) {
  const selectId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0, width: 190, maxHeight: 220 })
  const selected = options.find((item) => item.id === value)
  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query)
    return options.filter((item) => normalize(item.name).includes(normalizedQuery))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !optionsRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const updatePopupPosition = () => {
      const bounds = rootRef.current?.getBoundingClientRect()
      if (!bounds) return
      const margin = 12
      const gap = 5
      const width = Math.min(Math.max(bounds.width, 190), window.innerWidth - margin * 2)
      const left = Math.max(margin, Math.min(bounds.left, window.innerWidth - width - margin))
      const roomBelow = window.innerHeight - bounds.bottom - gap - margin
      const roomAbove = bounds.top - gap - margin
      const showAbove = roomBelow < 150 && roomAbove > roomBelow
      const maxHeight = Math.max(90, Math.min(220, showAbove ? roomAbove : roomBelow))
      setPopupPosition({ top: showAbove ? bounds.top - gap - maxHeight : bounds.bottom + gap, left, width, maxHeight })
    }
    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
  }, [open])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault()
      onChange(filtered[activeIndex].id)
      setQuery('')
      setOpen(false)
    } else if (event.key === 'Escape') {
      setQuery('')
      setOpen(false)
    }
  }

  return <div className="market-select" ref={rootRef}>
    <div className={`market-select-control ${open ? 'is-open' : ''}`}>
      <Icon name="search" size={15} />
      <input
        aria-label="Pesquisar item de mercado"
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? `${selectId}-option-${activeIndex}` : undefined}
        aria-controls={`${selectId}-options`}
        aria-expanded={open}
        aria-haspopup="listbox"
        autoComplete="off"
        role="combobox"
        placeholder={options.length ? 'Buscar item...' : 'Cadastre itens no mercado'}
        value={open ? query : selected?.name ?? ''}
        disabled={!options.length}
        onFocus={() => { setQuery(''); setOpen(true); setActiveIndex(0) }}
        onClick={() => { if (!open) { setQuery(''); setOpen(true); setActiveIndex(0) } }}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true) }}
        onKeyDown={handleKeyDown}
      />
      <span className="market-select-caret" aria-hidden="true" />
    </div>
    {open && createPortal(<div className="market-select-options" id={`${selectId}-options`} ref={optionsRef} role="listbox" aria-label="Itens de mercado" style={{ top: popupPosition.top, left: popupPosition.left, width: popupPosition.width, maxHeight: popupPosition.maxHeight }}>
      {filtered.length ? filtered.map((item, index) => <button
        className={`market-select-option ${item.id === value ? 'selected' : ''} ${index === activeIndex ? 'active' : ''}`}
        id={`${selectId}-option-${index}`}
        key={item.id}
        role="option"
        aria-selected={item.id === value}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => { onChange(item.id); setQuery(''); setOpen(false) }}
        type="button"
      >
        <span>{item.name || 'Item sem nome'}</span>
        {item.id === value && <Icon name="check" size={15} />}
      </button>) : <div className="market-select-empty">Nenhum item encontrado.</div>}
    </div>, document.body)}
  </div>
}

function SalePriceSimulation({ result, onPriceChange }: { result: CalculatedProduction; onPriceChange: (price: number | undefined) => void }) {
  const inputId = useId()
  const [priceDraft, setPriceDraft] = useState(() => result.expectedSalePrice === undefined ? '' : String(result.expectedSalePrice).replace('.', ','))
  const price = asNumber(priceDraft, NaN)
  const revenue = price * result.packages
  const validPrice = priceDraft.trim() !== '' && Number.isFinite(price) && price >= 0 && Number.isFinite(revenue)
  const balance = revenue - result.cost
  const profit = Math.abs(balance) <= Number.EPSILON * Math.max(1, Math.abs(revenue), Math.abs(result.cost)) ? 0 : balance
  const hasResults = validPrice && result.packages > 0
  const invalidPrice = priceDraft.trim() !== '' && !validPrice
  const roundUp = (value: number) => Math.ceil(value - Number.EPSILON * Math.max(1, Math.abs(value)))
  const breakEvenPackages = result.cost === 0 ? 0 : price > 0 ? roundUp(result.cost / price) : Infinity

  return <section className="sale-simulation" aria-labelledby={`${inputId}-title`}>
    <div className="panel-heading"><h2 id={`${inputId}-title`}>Venda esperada</h2></div>
    <label className="field simulation-price-field" htmlFor={inputId}>
      <span>Preço de venda desejado / pacote</span>
      <div className="currency-input"><span>R$</span><input id={inputId} type="text" inputMode="decimal" placeholder={moneyInputValue(result.salePrice)} value={priceDraft} aria-invalid={invalidPrice} aria-describedby={invalidPrice ? `${inputId}-error` : undefined} onChange={(event) => {
        const draft = event.target.value
        setPriceDraft(draft)
        if (!draft.trim()) {
          onPriceChange(undefined)
          return
        }
        const nextPrice = asNumber(draft, NaN)
        if (Number.isFinite(nextPrice) && nextPrice >= 0 && Number.isFinite(nextPrice * result.packages)) onPriceChange(nextPrice)
      }} /></div>
    </label>
    {invalidPrice && <p className="simulation-message text-negative" id={`${inputId}-error`}>Informe um preço válido maior ou igual a zero.</p>}
    {validPrice && result.packages === 0 && <p className="simulation-message">Sem pacotes disponíveis para venda.</p>}
    <div className="production-results simulation-results" aria-live="polite">
      <div><span>Custo / pacote</span><strong>{result.packages > 0 ? money(result.costPerPackage) : '—'}</strong></div>
      <div><span>Faturamento esperado</span><strong>{hasResults ? money(revenue) : '—'}</strong></div>
      <div><span>Lucro esperado</span><strong className={hasResults && profit < 0 ? 'text-negative' : undefined}>{hasResults ? money(profit) : '—'}</strong></div>
      <div><span>Lucro / pacote</span><strong className={hasResults && profit < 0 ? 'text-negative' : undefined}>{hasResults ? money(profit / result.packages) : '—'}</strong></div>
      <div><span>Acréscimo sobre custo</span><strong>{hasResults && result.cost > 0 ? `${number(profit / result.cost * 100, 1)}%` : '—'}</strong></div>
      <div><span>Margem sobre venda</span><strong>{hasResults && revenue > 0 ? `${number(profit / revenue * 100, 1)}%` : '—'}</strong></div>
      <div><span>Pacotes para cobrir o custo</span><strong>{hasResults ? Number.isFinite(breakEvenPackages) ? `${number(breakEvenPackages)} pacotes` : 'Inviável a este preço' : '—'}</strong></div>
    </div>
    {hasResults && profit <= 0 && <p className={`simulation-message ${profit < 0 ? 'text-negative' : 'text-positive'}`} role="status">
      {profit < 0
        ? `Mesmo vendendo todos os pacotes, faltariam ${money(-profit)} para cobrir o custo registrado.`
        : 'A venda de todos os pacotes cobre exatamente o custo registrado, sem lucro.'}
    </p>}
  </section>
}

function App() {
  const [initialData] = useState(readSavedData)
  const [market, setMarket] = useState<MarketItem[]>(initialData.market)
  const [recipes, setRecipes] = useState<Recipe[]>(initialData.recipes)
  const [productions, setProductions] = useState<Production[]>(initialData.productions)
  const [sales, setSales] = useState<Sale[]>(initialData.sales)
  const [page, setPage] = useState<Page>('overview')
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? '')
  const [selectedProductionId, setSelectedProductionId] = useState('')
  const [search, setSearch] = useState('')
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ market, recipes, productions, sales })) }, [market, recipes, productions, sales])

  useEffect(() => {
    if (!pendingDelete) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDelete(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingDelete])

  const calculated = useMemo(() => productions.map(calculateProduction), [productions])
  const totals = useMemo(() => calculated.reduce((acc, production) => ({
    revenue: acc.revenue + production.revenue,
    cost: acc.cost + production.cost,
    profit: acc.profit + production.profit,
    packages: acc.packages + production.packages,
    produced: acc.produced + production.produced,
  }), { revenue: 0, cost: 0, profit: 0, packages: 0, produced: 0 }), [calculated])
  const activeRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? recipes[0]
  const activeRecipeCost = activeRecipe ? recipeCostPerBatch(activeRecipe, market) : 0
  const sortedMarket = useMemo(() => [...market].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true })), [market])
  const filteredMarket = sortedMarket.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
  const availableMarketItems = activeRecipe
    ? sortedMarket.filter((item) => !activeRecipe.ingredients.some((ingredient) => ingredient.marketItemId === item.id))
    : sortedMarket

  const updateRecipe = (id: string, patch: Partial<Recipe>) => setRecipes((current) => current.map((recipe) => recipe.id === id ? { ...recipe, ...patch } : recipe))
  const updateMarket = (id: string, patch: Partial<MarketItem>) => setMarket((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  const updateIngredient = (recipeId: string, ingredientId: string, patch: Partial<Ingredient>) => {
    setRecipes((current) => current.map((recipe) => recipe.id === recipeId ? { ...recipe, ingredients: recipe.ingredients.map((ingredient) => ingredient.id === ingredientId ? { ...ingredient, ...patch } : ingredient) } : recipe))
  }
  const addRecipe = () => {
    const recipe: Recipe = { id: makeId(), name: '', category: '', yield: 0, hoursPerBatch: 0, ingredients: [] }
    setRecipes((current) => [...current, recipe])
    setSelectedRecipeId(recipe.id)
    setPage('recipe-detail')
  }
  const addMarketItem = () => setMarket((current) => [...current, { id: makeId(), name: '', unit: '', packageQty: 1, packagePrice: 0 }])
  const addIngredient = () => {
    if (!activeRecipe || availableMarketItems.length === 0) return
    updateRecipe(activeRecipe.id, { ingredients: [...activeRecipe.ingredients, { id: makeId(), marketItemId: availableMarketItems[0].id, quantity: 0 }] })
  }
  const addProduction = () => {
    if (!recipes.length) {
      setPage('recipes')
      setNotice('Cadastre uma receita antes de registrar uma produção.')
      return
    }
    const recipe = recipes[0]
    const production: Production = {
      id: makeId(), date: localToday(), recipeId: recipe.id, recipeName: recipe.name || 'Receita sem nome',
      quantity: 1, actualYield: recipe.yield, losses: 0, margin: 0, packageQty: 1, yieldPerBatch: recipe.yield,
      ingredientCostPerBatch: recipeCostPerBatch(recipe, market),
    }
    setProductions((current) => [production, ...current])
    setSelectedProductionId(production.id)
    setPage('production-detail')
  }
  const updateProduction = (id: string, patch: Partial<Production>) => {
    const production = productions.find((entry) => entry.id === id)
    if (!production) return
    const linkedSales = sales.filter((sale) => sale.productionId === id)
    const sold = linkedSales.reduce((total, sale) => total + sale.packages, 0)
    if (linkedSales.length && ((patch.recipeId !== undefined && patch.recipeId !== production.recipeId) || (patch.packageQty !== undefined && patch.packageQty !== production.packageQty))) {
      setNotice('Esta produção já possui vendas. A receita e a quantidade por pacote não podem ser alteradas enquanto houver vendas vinculadas.')
      return
    }
    if (calculateProduction({ ...production, ...patch }).packages < sold) {
      setNotice(`Esta produção já tem ${number(sold)} pacotes vendidos. O rendimento não pode ficar abaixo desse total.`)
      return
    }
    if (patch.date && linkedSales.some((sale) => sale.date < patch.date!)) {
      setNotice('A data da produção não pode ser posterior às vendas já registradas.')
      return
    }
    setProductions((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry))
  }
  const saveSale = (draft: SaleDraft): string | undefined => {
    const production = calculated.find((entry) => entry.id === draft.productionId)
    if (!production) return 'A produção selecionada não está disponível.'
    const existing = draft.id ? sales.find((sale) => sale.id === draft.id) : undefined
    if (draft.id && !existing) return 'Esta venda não está mais disponível.'
    if (!Number.isInteger(draft.packages) || draft.packages <= 0 || !Number.isFinite(draft.pricePerPackage) || draft.pricePerPackage < 0 || !Number.isFinite(draft.packages * draft.pricePerPackage)) return 'Informe uma quantidade e um preço válidos.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(new Date(`${draft.date}T12:00:00`).getTime()) || (production.date && draft.date < production.date)) return 'A data da venda deve ser igual ou posterior à produção.'
    const sold = sales.filter((sale) => sale.productionId === production.id && sale.id !== draft.id).reduce((total, sale) => total + sale.packages, 0)
    if (sold + draft.packages > production.packages) return `Esta produção tem apenas ${number(Math.max(0, production.packages - sold))} pacotes disponíveis.`
    const sameProduction = existing?.productionId === production.id
    const sale: Sale = {
      ...draft, id: existing?.id ?? makeId(),
      recipeName: sameProduction ? existing.recipeName : production.recipeName,
      productionDate: sameProduction ? existing.productionDate : production.date,
      costPerPackage: sameProduction ? existing.costPerPackage : production.costPerPackage,
    }
    setSales((current) => existing ? current.map((entry) => entry.id === existing.id ? sale : entry) : [sale, ...current])
    return undefined
  }
  const confirmDelete = () => {
    if (!pendingDelete) return
    if (pendingDelete.kind === 'recipe') {
      const next = recipes.filter((recipe) => recipe.id !== pendingDelete.id)
      setRecipes(next)
      if (selectedRecipeId === pendingDelete.id) {
        setSelectedRecipeId(next[0]?.id ?? '')
        setPage('recipes')
      }
    } else if (pendingDelete.kind === 'production') {
      if (sales.some((sale) => sale.productionId === pendingDelete.id)) {
        setNotice('Esta produção possui vendas registradas. Exclua as vendas vinculadas antes de remover a produção.')
        setPendingDelete(null)
        return
      }
      setProductions((current) => current.filter((production) => production.id !== pendingDelete.id))
      if (selectedProductionId === pendingDelete.id) {
        setSelectedProductionId('')
        setPage('production')
      }
    } else if (pendingDelete.kind === 'sale') {
      setSales((current) => current.filter((sale) => sale.id !== pendingDelete.id))
    } else if (pendingDelete.kind === 'market') {
      setMarket((current) => current.filter((item) => item.id !== pendingDelete.id))
      setRecipes((current) => current.map((recipe) => ({ ...recipe, ingredients: recipe.ingredients.filter((ingredient) => ingredient.marketItemId !== pendingDelete.id) })))
    } else {
      setRecipes((current) => current.map((recipe) => recipe.id === pendingDelete.recipeId ? { ...recipe, ingredients: recipe.ingredients.filter((ingredient) => ingredient.id !== pendingDelete.id) } : recipe))
    }
    setPendingDelete(null)
  }
  const exportWorkbook = () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(market.map((item) => ({ Item: item.name, Unidade: item.unit, 'Qtd pacote': item.packageQty, 'Valor pacote': item.packagePrice, 'Custo por unidade': unitCost(item) }))), 'Mercado')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(recipes.map((recipe) => ({ Receita: recipe.name, Categoria: recipe.category, Rendimento: recipe.yield, 'Horas por receita': recipe.hoursPerBatch, 'Custo por lote': recipeCostPerBatch(recipe, market) }))), 'Receitas')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ({ Receita: recipe.name, Item: market.find((item) => item.id === ingredient.marketItemId)?.name ?? 'Item removido', Quantidade: ingredient.quantity })))), 'Ingredientes')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productions.map((production) => {
      const result = calculateProduction(production)
      return { Data: production.date, Receita: production.recipeName, 'Qtd. receitas': production.quantity, 'Rendimento obtido': production.actualYield, Perdas: production.losses, 'Rendimento líquido': result.produced, 'Qtd. por pacote': production.packageQty, 'Acréscimo sobre custo (%)': production.margin, Custo: result.cost, Pacotes: result.packages, 'Preço sugerido': result.salePrice, Faturamento: result.revenue, Lucro: result.profit }
    })), 'Produções')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sales.map((sale) => ({ 'Data da venda': sale.date, 'Data da produção': sale.productionDate, Receita: sale.recipeName, Cliente: sale.customer, Pacotes: sale.packages, 'Preço real por pacote': sale.pricePerPackage, Total: sale.packages * sale.pricePerPackage, Recebido: sale.paid ? 'Sim' : 'Não', 'Custo dos pacotes vendidos': sale.packages * sale.costPerPackage, 'Resultado da venda': sale.packages * (sale.pricePerPackage - sale.costPerPackage), Observações: sale.notes }))), 'Vendas')
    XLSX.writeFile(workbook, 'doce-controle.xlsx')
  }

  const importWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheets = workbook.SheetNames.map((name) => ({ name: normalize(name), rows: XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[name], { defval: '' }) }))
      const marketRows = sheets.flatMap(({ name, rows }) => rows.filter((row) => valueFor(row, ['item', 'produto', 'insumo', 'ingrediente', 'material']) !== undefined && valueFor(row, ['valor pacote', 'preco pacote', 'preco', 'valor', 'custo', 'preco mercado']) !== undefined).map((row) => ({ name, row })))
      const importedItems: MarketItem[] = []
      const itemIds = new Map<string, string>()
      for (const { row } of marketRows) {
        const itemName = asText(valueFor(row, ['item', 'produto', 'insumo', 'ingrediente', 'material']))
        if (!itemName) continue
        const key = normalize(itemName)
        if (itemIds.has(key)) continue
        const item: MarketItem = {
          id: makeId(), name: itemName,
          unit: asText(valueFor(row, ['unidade', 'un']), 'g'),
          packageQty: asNumber(valueFor(row, ['qtd pacote', 'quantidade pacote', 'quantidade', 'qtd', 'peso', 'conteudo']), 1),
          packagePrice: asNumber(valueFor(row, ['valor pacote', 'preco pacote', 'preco', 'valor', 'custo', 'preco mercado']), 0),
        }
        itemIds.set(key, item.id)
        importedItems.push(item)
      }
      const recipeRows = sheets.flatMap(({ rows }) => rows.filter((row) => valueFor(row, ['receita', 'nome receita', 'produto final']) !== undefined).map((row) => row))
      const grouped = new Map<string, Recipe>()
      for (const row of recipeRows) {
        const name = asText(valueFor(row, ['receita', 'nome receita', 'produto final']))
        if (!name) continue
        const key = normalize(name)
        let recipe = grouped.get(key)
        if (!recipe) {
          recipe = { id: makeId(), name, category: asText(valueFor(row, ['categoria', 'grupo']), 'Receitas'), yield: asNumber(valueFor(row, ['rendimento', 'rendimento receita', 'unidades por receita']), 0), hoursPerBatch: asNumber(valueFor(row, ['horas por receita', 'horas por lote', 'tempo de preparo', 'horas']), 0), ingredients: [] }
          grouped.set(key, recipe)
        }
        const ingredientName = asText(valueFor(row, ['item', 'produto', 'insumo', 'ingrediente', 'material']))
        const ingredientQuantity = valueFor(row, ['quantidade ingrediente', 'qtd ingrediente', 'quantidade usada', 'quantidade usada na receita', 'qtd usada', 'consumo'])
        if (ingredientName && ingredientQuantity !== undefined) {
          const ingredientKey = normalize(ingredientName)
          let itemId = itemIds.get(ingredientKey)
          if (!itemId) {
            const item: MarketItem = { id: makeId(), name: ingredientName, unit: 'g', packageQty: 1, packagePrice: 0 }
            importedItems.push(item)
            itemIds.set(ingredientKey, item.id)
            itemId = item.id
          }
          recipe.ingredients.push({ id: makeId(), marketItemId: itemId, quantity: asNumber(ingredientQuantity, 0) })
        }
      }
      if (!importedItems.length && !grouped.size) throw new Error('Não encontrei colunas de mercado ou receita reconhecíveis.')
      if (importedItems.length) setMarket(importedItems)
      if (grouped.size) {
        const nextRecipes = [...grouped.values()]
        setRecipes(nextRecipes)
        setSelectedRecipeId(nextRecipes[0].id)
      }
      setNotice(`Planilha importada: ${importedItems.length} itens de mercado e ${grouped.size} receitas.`)
      setTimeout(() => setNotice(''), 5000)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível importar a planilha.')
      setTimeout(() => setNotice(''), 5000)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" onClick={() => setPage('overview')} aria-label="Doce Controle, início">
          <span className="brand-mark">d<span>.</span></span>
          <span className="brand-name">doce<span>controle</span></span>
        </a>
        <div className="workspace-label">ESPAÇO DE TRABALHO</div>
        <nav className="main-nav" aria-label="Navegação principal">
          <button className={page === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('overview')}><Icon name="overview" /> Visão geral</button>
          <button className={page === 'recipes' || page === 'recipe-detail' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('recipes')}><Icon name="recipe" /> Receitas <span className="nav-count">{recipes.length}</span></button>
          <button className={page === 'production' || page === 'production-detail' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('production')}><Icon name="chart" /> Produção <span className="nav-count">{productions.length}</span></button>
          <button className={page === 'sales' ? 'nav-item active' : 'nav-item'} title="Vendas" onClick={() => setPage('sales')}><ShoppingBag size={18} aria-hidden="true" /> Vendas <span className="nav-count">{sales.length}</span></button>
          <button className={page === 'market' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('market')}><Icon name="market" /> Mercado <span className="nav-count">{market.length}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-status"><span className="status-dot" /><div><strong>Dados salvos</strong><small>neste dispositivo</small></div></div>
          <div className="profile"><div className="avatar">DC</div><div><strong>Minha confeitaria</strong><small>Plano pessoal</small></div><span className="profile-dots">···</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Painel <span>/</span> {page === 'overview' ? 'Visão geral' : page === 'recipes' || page === 'recipe-detail' ? 'Receitas' : page === 'production' || page === 'production-detail' ? 'Produção' : page === 'sales' ? 'Vendas' : 'Mercado'}{(page === 'recipe-detail' || page === 'production-detail') && <><span>/</span> Detalhes</>}</div>
          <div className="topbar-actions">
            <button className="text-button" onClick={exportWorkbook}><Icon name="download" size={16} /> Exportar Excel</button>
          </div>
        </header>

        <div className="page-wrap">
          {notice && <div className="notice" role="status"><Icon name="check" size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso"><Icon name="close" size={16} /></button></div>}
          {page === 'sales' && <Sales productions={calculated} sales={sales} onSave={saveSale} onDelete={(sale) => setPendingDelete({ kind: 'sale', id: sale.id, label: `${sale.recipeName} — ${sale.date}` })} onViewProduction={(id) => { setSelectedProductionId(id); setPage(id ? 'production-detail' : 'production') }} />}
          {page === 'overview' && <>
            <section className="welcome-row">
              <div><div className="eyebrow"><span className="eyebrow-dot" /> SEU NEGÓCIO, EM NÚMEROS</div><h1>Visão geral</h1><p>Um resumo claro dos custos e do potencial das suas receitas.</p></div>
              <div className="welcome-actions"><input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={importWorkbook} hidden /><button className="button button-secondary" onClick={() => fileInput.current?.click()}><Icon name="upload" size={17} /> Importar planilha</button></div>
            </section>

            <section className="metric-grid" aria-label="Resumo financeiro">
              <article className="metric-card"><div className="metric-top"><span>Faturamento previsto</span><span className="metric-icon mint"><Icon name="chart" /></span></div><strong>{money(totals.revenue)}</strong><div className="metric-foot"><span>projeção dos registros</span><span>de produção</span></div></article>
              <article className="metric-card"><div className="metric-top"><span>Custo de produção</span><span className="metric-icon peach"><Icon name="wallet" /></span></div><strong>{money(totals.cost)}</strong><div className="metric-foot"><span>Soma dos custos registrados</span></div></article>
              <article className="metric-card"><div className="metric-top"><span>Lucro previsto</span><span className="metric-icon lavender"><Icon name="chart" /></span></div><strong>{money(totals.profit)}</strong><div className="metric-foot"><span className={totals.profit >= 0 ? 'text-positive' : 'text-negative'}>{totals.revenue > 0 ? `${number(totals.profit / totals.revenue * 100, 1)}%` : '0%'} de margem média</span></div></article>
              <article className="metric-card"><div className="metric-top"><span>Pacotes produzidos</span><span className="metric-icon yellow"><Icon name="package" /></span></div><strong>{number(totals.packages)}</strong><div className="metric-foot"><span>{number(totals.produced)} unidades líquidas</span></div></article>
            </section>

            <section className="overview-grid">
              <article className="panel revenue-panel">
                <div className="panel-heading"><div><h2>Resultados por produção</h2><p>Faturamento registrado em cada produção</p></div><span className="period-pill"><span /> Histórico</span></div>
                {calculated.length ? <div className="chart-area">
                  <div className="chart-y-labels"><span>{money(Math.max(1, ...calculated.map((r) => r.revenue)))}</span><span>{money(Math.max(1, ...calculated.map((r) => r.revenue)) / 2)}</span><span>R$ 0</span></div>
                  <div className="bar-chart">{calculated.slice(0, 6).map((production, index) => {
                    const max = Math.max(1, ...calculated.map((entry) => entry.revenue))
                    return <div className="bar-column" key={production.id}><div className="bar-value">{money(production.revenue)}</div><div className="bar-track"><div className={`bar-fill bar-${index % 4}`} style={{ height: `${Math.max(production.revenue > 0 ? 8 : 0, production.revenue / max * 100)}%` }} /></div><span className="bar-label">{production.recipeName}</span></div>
                  })}</div>
                </div> : <div className="empty-state">Registre uma produção para visualizar seus resultados.</div>}
                <div className="chart-legend"><span><i /> Faturamento registrado</span><span className="chart-note">Cada registro preserva custo e rendimento do momento da produção.</span></div>
              </article>

              <article className="panel quick-panel">
                <div className="panel-heading"><div><h2>Resumo do negócio</h2><p>Seu planejamento atual</p></div><span className="round-icon"><Icon name="overview" size={17} /></span></div>
                <div className="quick-total"><span>Lucro previsto acumulado</span><strong>{money(totals.profit)}</strong></div>
                <div className="quick-progress"><div style={{ width: `${Math.min(100, totals.revenue > 0 ? Math.max(0, totals.profit / totals.revenue * 100) : 0)}%` }} /></div>
                <div className="quick-row"><span><i className="legend-dot dot-cost" /> Custo total</span><strong>{money(totals.cost)}</strong></div>
                <div className="quick-row"><span><i className="legend-dot dot-profit" /> Lucro estimado</span><strong>{money(totals.profit)}</strong></div>
                <div className="quick-divider" />
                <div className="quick-foot"><span><b>{productions.length}</b> registros de produção</span><button className="inline-link" onClick={() => setPage('production')}>Ver produção <Icon name="arrow" size={14} /></button></div>
              </article>
            </section>

            <section className="panel recipe-summary-panel">
              <div className="panel-heading"><div><h2>Histórico de produção recente</h2><p>Resultados de cada registro de produção</p></div><button className="inline-link" onClick={() => setPage('production')}>Ver histórico <Icon name="arrow" size={14} /></button></div>
              {calculated.length ? <div className="table-scroll"><table className="data-table overview-table"><thead><tr><th>Data</th><th>Receita</th><th>Qtd. lotes</th><th>Rendimento líquido</th><th>Custo</th><th>Preço por pacote</th><th>Faturamento</th></tr></thead><tbody>{calculated.slice(0, 5).map((production) => <tr key={production.id}><td>{production.date}</td><td><div className="recipe-name-cell"><span className="recipe-thumb">{production.recipeName.slice(0, 1).toUpperCase()}</span><div><strong>{production.recipeName}</strong></div></div></td><td>{number(production.quantity)}</td><td>{number(production.produced)} un.</td><td>{money(production.cost)}</td><td className="price-cell">{money(production.salePrice)}</td><td className="price-cell">{money(production.revenue)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Ainda não há produções registradas.</div>}
            </section>
            <div className="footnote"><Icon name="check" size={14} /> Alterações em receitas e preços são salvas automaticamente neste dispositivo.</div>
          </>}

          {(page === 'recipes' || page === 'recipe-detail') && <>
            {page === 'recipe-detail' && <button className="text-button detail-back" onClick={() => setPage('recipes')}><ArrowLeft size={17} aria-hidden="true" /> Voltar para receitas</button>}
            <section className="welcome-row page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> FICHAS TÉCNICAS</div><h1>{page === 'recipe-detail' ? activeRecipe?.name || 'Receita sem nome' : 'Receitas'}</h1>{page === 'recipes' && <p>{recipes.length} receitas cadastradas</p>}</div>{page === 'recipes' && <button className="button button-primary" onClick={addRecipe}><Icon name="plus" size={17} /> Nova receita</button>}</section>
            {page === 'recipes' ? <section className="item-list" aria-label="Lista de receitas">
              {recipes.map((recipe) => <article className="item-summary" key={recipe.id}>
                <div className="item-summary-name"><span className="recipe-thumb">{recipe.name.slice(0, 1).toUpperCase() || 'R'}</span><div><h2>{recipe.name || 'Receita sem nome'}</h2><span>{recipe.category || 'Sem categoria'}</span></div></div>
                <dl className="item-summary-metrics"><div><dt>Rendimento / lote</dt><dd>{number(recipe.yield)} un.</dd></div><div><dt>Ingredientes</dt><dd>{number(recipe.ingredients.length)}</dd></div><div><dt>Custo / lote</dt><dd>{money(recipeCostPerBatch(recipe, market))}</dd></div></dl>
                <button className="icon-button view-item" aria-label={`Visualizar receita ${recipe.name || 'sem nome'}`} title="Visualizar receita" onClick={() => { setSelectedRecipeId(recipe.id); setPage('recipe-detail') }}><Eye size={18} aria-hidden="true" /></button>
              </article>)}
              {!recipes.length && <div className="empty-inline">Cadastre uma receita para criar sua primeira ficha técnica.</div>}
            </section> : activeRecipe ? <section className="panel editor-panel">
                <div className="editor-heading"><div className="recipe-heading-icon">{activeRecipe.name.slice(0, 1).toUpperCase() || 'R'}</div><div className="editor-title">
                  <label className="recipe-edit-field"><span>Nome da receita</span><input className="recipe-title-input" aria-label="Nome da receita" placeholder="Ex.: Bolo de cenoura" value={activeRecipe.name} onChange={(event) => updateRecipe(activeRecipe.id, { name: event.target.value })} /></label>
                  <label className="recipe-edit-field"><span>Categoria</span><input className="category-input" aria-label="Categoria da receita" placeholder="Ex.: Bolos" value={activeRecipe.category} onChange={(event) => updateRecipe(activeRecipe.id, { category: event.target.value })} /></label>
                </div><button className="icon-button danger-button" aria-label="Excluir receita" title="Excluir receita" onClick={() => setPendingDelete({ kind: 'recipe', id: activeRecipe.id, label: activeRecipe.name || 'Receita sem nome' })}><Icon name="trash" size={17} /></button></div>
                <div className="section-caption"><span>RENDIMENTO POR LOTE</span><span className="caption-rule" /></div>
                <div className="parameter-grid recipe-yield-grid"><label className="field"><span>Rendimento da receita</span><div className="input-suffix"><input type="number" min="0" step="1" value={activeRecipe.yield} onChange={(event) => updateRecipe(activeRecipe.id, { yield: Math.max(0, Number(event.target.value)) })} /><em>un./lote</em></div></label><label className="field"><span>Horas por receita</span><div className="input-suffix"><input type="number" min="0" step="0.1" value={activeRecipe.hoursPerBatch} onChange={(event) => updateRecipe(activeRecipe.id, { hoursPerBatch: Math.max(0, Number(event.target.value)) })} /><em>horas</em></div></label><div className="recipe-batch-cost"><span>Custo atual por lote</span><strong>{money(activeRecipeCost)}</strong><small>calculado com os preços atuais do mercado</small></div></div>
                <div className="section-caption ingredients-caption"><span>INGREDIENTES E CUSTOS</span><span className="caption-rule" />{availableMarketItems.length > 0 ? <button className="inline-link" onClick={addIngredient}><Icon name="plus" size={14} /> Adicionar item</button> : <span className="ingredient-limit-hint">{sortedMarket.length ? 'Todos os itens do mercado já estão nesta receita.' : 'Cadastre itens no mercado para adicionar ingredientes.'}</span>}</div>
                <div className="ingredient-table-wrap"><table className="ingredient-table"><thead><tr><th>Item de mercado</th><th>Quantidade</th><th>Unidade</th><th>Custo unitário</th><th>Total</th><th /></tr></thead><tbody>{activeRecipe.ingredients.map((ingredient) => {
                  const item = market.find((entry) => entry.id === ingredient.marketItemId)
                  const selectableItems = sortedMarket.filter((option) => option.id === ingredient.marketItemId || !activeRecipe.ingredients.some((other) => other.id !== ingredient.id && other.marketItemId === option.id))
                  return <tr key={ingredient.id}><td><SearchableMarketSelect options={selectableItems} value={ingredient.marketItemId} onChange={(marketItemId) => updateIngredient(activeRecipe.id, ingredient.id, { marketItemId })} /></td><td><input className="table-number" aria-label="Quantidade usada por lote" type="number" min="0" step="0.1" value={ingredient.quantity} onChange={(event) => updateIngredient(activeRecipe.id, ingredient.id, { quantity: Math.max(0, Number(event.target.value)) })} /></td><td>{item?.unit ?? '—'}</td><td>{money(item ? unitCost(item) : 0)}</td><td className="price-cell">{money(item ? unitCost(item) * ingredient.quantity : 0)}</td><td><button className="mini-icon-button" aria-label="Remover ingrediente" onClick={() => setPendingDelete({ kind: 'ingredient', recipeId: activeRecipe.id, id: ingredient.id, label: item?.name || 'Ingrediente' })}><Icon name="close" size={15} /></button></td></tr>
                })}</tbody></table>{activeRecipe.ingredients.length === 0 && <div className="empty-inline">Adicione itens do mercado para calcular o custo desta receita.</div>}</div>
                <p className="formula-note">Os ingredientes e quantidades formam a ficha de um lote. Os parâmetros de fabricação e resultados ficam registrados separadamente em Produção.</p>
              </section> : <section className="panel empty-editor"><span className="empty-illustration"><Icon name="recipe" size={28} /></span><h2>Nenhuma receita cadastrada</h2><p>Crie uma ficha técnica para usar nos registros de produção.</p><button className="button button-primary" onClick={addRecipe}><Icon name="plus" size={16} /> Criar receita</button></section>}
          </>}

          {(page === 'production' || page === 'production-detail') && <>
            {page === 'production-detail' && <button className="text-button detail-back" onClick={() => setPage('production')}><ArrowLeft size={17} aria-hidden="true" /> Voltar para produção</button>}
            <section className="welcome-row page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> REGISTRO E RESULTADOS</div><h1>{page === 'production-detail' ? 'Detalhes da produção' : 'Produção'}</h1>{page === 'production' && <p>{productions.length} registros de produção</p>}</div>{page === 'production' && <button className="button button-primary" onClick={addProduction} disabled={!recipes.length}><Icon name="plus" size={17} /> Registrar produção</button>}</section>
            {page === 'production' && productions.length > 0 ? <section className="item-list" aria-label="Lista de produção">
              {calculated.slice().sort((first, second) => second.date.localeCompare(first.date)).map((production) => {
                const hasExpectedPrice = production.expectedSalePrice !== undefined
                const revenue = (production.expectedSalePrice ?? production.salePrice) * production.packages
                const balance = revenue - production.cost
                const profit = hasExpectedPrice
                  ? Math.abs(balance) <= Number.EPSILON * Math.max(1, Math.abs(revenue), Math.abs(production.cost)) ? 0 : balance
                  : production.profit
                return <article className="item-summary" key={production.id}>
                <div className="item-summary-name"><span className="recipe-thumb">{production.recipeName.slice(0, 1).toUpperCase() || 'R'}</span><div><h2>{production.recipeName}</h2><span>{production.date ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${production.date}T12:00:00`)) : 'Data não informada'} · {number(production.quantity)} lotes</span></div></div>
                <dl className="item-summary-metrics"><div><dt>Pacotes</dt><dd>{number(production.packages)}</dd></div><div><dt>Custo registrado</dt><dd>{money(production.cost)}</dd></div><div><dt>{hasExpectedPrice ? 'Lucro esperado' : 'Lucro previsto'}</dt><dd>{hasExpectedPrice && production.packages === 0 ? '—' : money(profit)}</dd></div></dl>
                <button className="icon-button view-item" aria-label={`Visualizar produção de ${production.recipeName} em ${production.date}`} title="Visualizar produção" onClick={() => { setSelectedProductionId(production.id); setPage('production-detail') }}><Eye size={18} aria-hidden="true" /></button>
              </article>
              })}
            </section> : page === 'production-detail' ? <section className="production-history">
                {productions.filter((production) => production.id === selectedProductionId).map((production) => {
                  const result = calculateProduction(production)
                  return <article className="panel production-record" key={production.id}>
                    <div className="production-record-heading">
                      <div className="production-date-field"><label htmlFor={`production-date-${production.id}`}>Data da produção</label><input id={`production-date-${production.id}`} type="date" value={production.date} onChange={(event) => updateProduction(production.id, { date: event.target.value })} /></div>
                      <div className="production-name"><span className="recipe-thumb">{production.recipeName.slice(0, 1).toUpperCase()}</span><div><strong>{production.recipeName}</strong><small>Rendimento da ficha: {number(production.yieldPerBatch)} un./lote</small></div></div>
                      <button className="icon-button danger-button" aria-label={`Excluir produção de ${production.recipeName}`} title="Excluir produção" onClick={() => setPendingDelete({ kind: 'production', id: production.id, label: `${production.recipeName} — ${production.date}` })}><Icon name="trash" size={17} /></button>
                    </div>
                    <div className="production-fields">
                      <label className="field"><span>Receita</span><select value={production.recipeId} onChange={(event) => {
                        const recipe = recipes.find((entry) => entry.id === event.target.value)
                        if (recipe) updateProduction(production.id, { recipeId: recipe.id, recipeName: recipe.name || 'Receita sem nome', yieldPerBatch: recipe.yield, actualYield: recipe.yield * production.quantity, ingredientCostPerBatch: recipeCostPerBatch(recipe, market) })
                      }}><option value="" disabled>Selecione receita</option>{!recipes.some((recipe) => recipe.id === production.recipeId) && <option value={production.recipeId}>{production.recipeName} (ficha removida)</option>}{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name || 'Receita sem nome'}</option>)}</select></label>
                      <label className="field"><span>Qtd. de receitas feitas</span><div className="input-suffix"><input type="number" min="0" step="1" value={production.quantity} onChange={(event) => updateProduction(production.id, { quantity: Math.max(0, Number(event.target.value)) })} /><em>lotes</em></div></label>
                      <label className="field"><span>Rendimento obtido</span><div className="input-suffix"><input type="number" min="0" step="1" value={production.actualYield} onChange={(event) => updateProduction(production.id, { actualYield: Math.max(0, Number(event.target.value)) })} /><em>unidades</em></div><small className="field-hint">Esperado pela ficha: {number(production.yieldPerBatch * production.quantity)} un.</small></label>
                      <label className="field"><span>Perdas</span><div className="input-suffix"><input type="number" min="0" step="1" value={production.losses} onChange={(event) => updateProduction(production.id, { losses: Math.max(0, Number(event.target.value)) })} /><em>unidades</em></div></label>
                      <label className="field"><span>Qtd. por pacote</span><div className="input-suffix"><input type="number" min="0.01" step="1" value={production.packageQty} onChange={(event) => updateProduction(production.id, { packageQty: Math.max(0.01, Number(event.target.value)) })} /><em>unidades</em></div></label>
                      <label className="field"><span>Lucro desejado sobre custo</span><div className="input-suffix"><input type="number" min="0" step="1" value={production.margin} onChange={(event) => updateProduction(production.id, { margin: Math.max(0, Number(event.target.value)) })} /><em>%</em></div><small className="field-hint">Acréscimo aplicado ao custo para sugerir o preço.</small></label>
                    </div>
                    <div className="production-results">
                      <div><span>Custo registrado</span><strong>{money(result.cost)}</strong></div>
                      <div><span>Rendimento líquido</span><strong>{number(result.produced)} un.</strong><small className="production-breakdown">{number(production.actualYield)} obtidas − {number(production.losses)} perdas</small></div>
                      <div><span>Pacotes possíveis</span><strong>{number(result.packages)}</strong></div>
                      <div><span>Preço sugerido / pacote</span><strong>{money(result.salePrice)}</strong></div>
                      <div><span>Faturamento previsto</span><strong>{money(result.revenue)}</strong></div>
                      <div><span>Lucro previsto</span><strong>{money(result.profit)}</strong></div>
                    </div>
                    <SalePriceSimulation result={result} onPriceChange={(expectedSalePrice) => updateProduction(production.id, { expectedSalePrice })} />
                  </article>
                })}
              </section> : !recipes.length ? <section className="panel empty-editor"><span className="empty-illustration"><Icon name="recipe" size={28} /></span><h2>Cadastre uma receita primeiro</h2><p>As fichas técnicas serão selecionadas ao criar cada registro de produção.</p><button className="button button-primary" onClick={() => setPage('recipes')}><Icon name="recipe" size={16} /> Ir para receitas</button></section> : <section className="panel empty-editor"><span className="empty-illustration"><Icon name="chart" size={28} /></span><h2>Nenhuma produção registrada</h2><p>Crie um registro para informar qual receita foi feita, em que quantidade e quais foram os resultados.</p><button className="button button-primary" onClick={addProduction}><Icon name="plus" size={16} /> Registrar primeira produção</button></section>}
          </>}

          {page === 'market' && <>
            <section className="welcome-row page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> PREÇOS E INSUMOS</div><h1>Mercado</h1><p>Atualize preços de compra e quantidades dos pacotes. Os custos das receitas mudam automaticamente.</p></div><button className="button button-primary" onClick={addMarketItem}><Icon name="plus" size={17} /> Novo item</button></section>
            <section className="market-stats"><div className="market-stat"><span>Itens cadastrados</span><strong>{market.length}</strong></div><div className="market-stat"><span>Itens usados em receitas</span><strong>{new Set(recipes.flatMap((recipe) => recipe.ingredients.map((entry) => entry.marketItemId))).size}</strong></div></section>
            <section className="panel market-panel"><div className="panel-heading market-heading"><div><h2>Itens de mercado</h2><p>Edite diretamente os campos para atualizar sua base de custos</p></div><label className="search-box"><Icon name="search" size={16} /><input placeholder="Buscar item..." value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
              <div className="table-scroll">
                <table className="data-table market-table">
                  <thead><tr><th>Item</th><th>Unidade</th><th>Qtd. no pacote</th><th>Valor do pacote</th><th>Custo por unidade</th><th /></tr></thead>
                  <tbody>{filteredMarket.map((item) => <tr key={item.id}>
                    <td><div className="market-product"><span className="product-icon"><Icon name="package" size={17} /></span><input aria-label="Nome do item" value={item.name} onChange={(event) => updateMarket(item.id, { name: event.target.value })} /></div></td>
                    <td><input className="market-cell-input unit-cell" aria-label="Unidade de medida" value={item.unit} onChange={(event) => updateMarket(item.id, { unit: event.target.value })} /></td>
                    <td><input className="market-cell-input numeric-cell" aria-label="Quantidade por pacote" type="number" min="0.01" step="any" value={item.packageQty} onChange={(event) => updateMarket(item.id, { packageQty: Math.max(0.01, Number(event.target.value)) })} /></td>
                    <td><div className="currency-input"><span>R$</span><input aria-label="Preço de compra do pacote" type="text" inputMode="decimal" value={priceDrafts[item.id] ?? moneyInputValue(item.packagePrice)} onFocus={() => setPriceDrafts((current) => ({ ...current, [item.id]: current[item.id] ?? moneyInputValue(item.packagePrice) }))} onChange={(event) => setPriceDrafts((current) => ({ ...current, [item.id]: event.target.value }))} onBlur={(event) => { const rawValue = event.currentTarget.value.trim(); const nextPrice = rawValue ? Math.max(0, asNumber(rawValue, item.packagePrice)) : item.packagePrice; updateMarket(item.id, { packagePrice: nextPrice }); setPriceDrafts((current) => { const next = { ...current }; delete next[item.id]; return next }) }} /></div></td>
                    <td className="unit-cost-cell">{money(unitCost(item))}<small>por {item.unit || 'un.'}</small></td>
                    <td><button className="mini-icon-button delete-item" aria-label={`Excluir ${item.name || 'item'}`} onClick={() => setPendingDelete({ kind: 'market', id: item.id, label: item.name || 'Item sem nome', ingredientCount: recipes.reduce((count, recipe) => count + recipe.ingredients.filter((ingredient) => ingredient.marketItemId === item.id).length, 0) })}><Icon name="trash" size={16} /></button></td>
                  </tr>)}</tbody>
                </table>
                {filteredMarket.length === 0 && <div className="empty-inline">Nenhum item encontrado. Tente outro termo ou cadastre um novo item.</div>}
              </div>
              <div className="market-footer"><span><i className="status-dot" /> Alterações salvas automaticamente</span><button className="button button-secondary button-small" onClick={addMarketItem}><Icon name="plus" size={15} /> Adicionar item</button></div>
            </section>
            <div className="footnote"><Icon name="check" size={14} /> O custo por unidade é calculado dividindo o valor do pacote pela quantidade informada.</div>
          </>}
        </div>
      </main>
      {pendingDelete && <div className="confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDelete(null) }}>
        <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
          <div className="confirm-icon"><Icon name="trash" size={21} /></div>
          <h2 id="confirm-title">Confirmar exclusão?</h2>
          <p id="confirm-description">
            {pendingDelete.kind === 'recipe'
              ? `A receita “${pendingDelete.label}” será excluída permanentemente.`
              : pendingDelete.kind === 'production'
                ? `O registro de produção “${pendingDelete.label}” será removido do histórico.`
                : pendingDelete.kind === 'sale'
                  ? `A venda “${pendingDelete.label}” será excluída. Os pacotes voltarão ao saldo disponível e os totais de vendas serão recalculados.`
                : pendingDelete.kind === 'market'
                ? `O item “${pendingDelete.label}” será excluído${pendingDelete.ingredientCount ? ` e removido de ${pendingDelete.ingredientCount} ${pendingDelete.ingredientCount === 1 ? 'receita' : 'receitas'}` : ''}. Esta ação não pode ser desfeita.`
                : `O ingrediente “${pendingDelete.label}” será removido desta receita.`}
          </p>
          <div className="confirm-actions">
            <button className="button button-secondary" autoFocus onClick={() => setPendingDelete(null)}>Cancelar</button>
            <button className="button confirm-delete-button" onClick={confirmDelete}><Icon name="trash" size={16} /> Excluir</button>
          </div>
        </section>
      </div>}
    </div>
  )
}

export default App
