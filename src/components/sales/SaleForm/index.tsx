import FormActions from "../../ui/FormActions";
import FormLayout, { FormGrid } from "../../ui/FormLayout";
import FormField from "../../ui/FormField";
import FormControl from "../../ui/FormControl";
import EmptyState from "../../ui/EmptyState";
import LoadingState from "../../ui/LoadingState";
import RemoteSelect from "../../ui/RemoteSelect";
import SearchableSelect from "../../ui/SearchableSelect";
import type { Resource } from "../../../hooks/useResource";
import type { SalePointInventory, SalePointSummary } from "../../../domain/models";
import { canReclassifySale, locationAvailable } from "../../../domain/salePoints";
import styles from "./styles.module.scss";
import PageHeader from "../../ui/PageHeader";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import Button from "../../ui/Button";
import BackButton from "../../ui/BackButton";
import { toast } from "react-toastify";
import type { ProductionBalance, Sale, SaleDraft } from "../../../domain/models";
import { remainingPackages } from "../../../domain/calculations";
import { queryService } from "../../../services/query";
import RegistrationModal from "../../ui/RegistrationModal";
import { showErrorToast } from "../../ui/Notifications/toast";
import {
  money,
  number as count,
  dateLabel,
  localToday as today,
  makeId,
} from "../../../utils/format";

type Props = {
  /**
   * Balance of the production preselected in the form: the edited sale's production or,
   * for a new sale, the most recent production with packages available.
   */
  initialBalance?: ProductionBalance | null;
  /** Packages available across every production (server summary), used to limit the cart. */
  totalAvailable: number;
  inventory?: Resource<SalePointInventory[]>;
  points?: Resource<SalePointSummary[]>;
  onSave: (draft: SaleDraft) => Promise<string | undefined | null>;
  onSaveSales: (drafts: SaleDraft[]) => Promise<string | undefined | null>;
};

const priceText = (value: number) => String(value).replace(".", ",");

type SaleEntry = {
  key: string;
  productionId: string;
  salePointId: string;
  date: string;
  packages: string;
  price: string;
  customer: string;
  paid: boolean;
  donated: boolean;
  notes: string;
};

function parseAmount(entry: SaleEntry) {
  const rawPrice = entry.price.trim().replace(/\s/g, "").replace(/R\$/i, "");
  const price = rawPrice
    ? Number(rawPrice.includes(",") ? rawPrice.replace(/\./g, "").replace(",", ".") : rawPrice)
    : NaN;
  const quantity = Number(entry.packages);
  const valid = Number.isInteger(quantity) && quantity > 0 &&
    Number.isFinite(price) && price >= 0 && Number.isFinite(quantity * price);
  return { price, quantity, valid };
}

export default function SaleForm({
  initialBalance,
  totalAvailable,
  inventory,
  points,
  sale,
  onSave,
  onSaveSales,
  isModal = false,
  onCancel,
}: Props & {
  sale?: Sale;
  isModal?: boolean;
  onCancel: () => void;
}) {
  // Balances of every production picked in this form, as returned by the server.
  const [known, setKnown] = useState<Record<string, ProductionBalance>>(() =>
    initialBalance ? { [initialBalance.id]: initialBalance } : {});
  /** Packages sold by the saved sales, excluding the sale being edited. */
  const soldPackages = (balance: ProductionBalance) =>
    balance.soldPackages - (sale && sale.productionId === balance.id ? sale.packages : 0);
  const createEntry = (production?: ProductionBalance, existing?: Sale): SaleEntry => ({
    key: makeId(),
    productionId: existing?.productionId ?? production?.id ?? "",
    salePointId: existing?.salePointId ?? "",
    date: existing?.date ?? today(),
    packages: String(existing?.packages ?? 1),
    price: priceText(existing?.pricePerPackage ?? production?.expectedSalePrice ?? production?.salePrice ?? 0),
    customer: existing?.customer ?? "",
    paid: existing?.paid ?? true,
    donated: existing?.donated ?? false,
    notes: existing?.notes ?? "",
  });
  const [entries, setEntries] = useState<SaleEntry[]>(() => [
    createEntry(initialBalance ?? undefined, sale),
  ]);
  const [activeKey, setActiveKey] = useState(entries[0].key);
  const [isSaving, setIsSaving] = useState(false);
  const cartListRef = useRef<HTMLUListElement>(null);
  const scrollCartToEnd = useRef(false);
  useEffect(() => {
    const list = cartListRef.current;
    if (!scrollCartToEnd.current || !list) return;
    list.scrollTop = list.scrollHeight;
    scrollCartToEnd.current = false;
  }, [entries.length]);
  const updateEntry = (key: string, patch: Partial<SaleEntry>) =>
    setEntries((current) => current.map((entry) => entry.key === key ? { ...entry, ...patch } : entry));
  const reservedPackages = (productionId: string, exceptKey?: string) =>
    entries.filter((entry) => entry.productionId === productionId && entry.key !== exceptKey)
      .reduce((total, entry) => {
        const quantity = Number(entry.packages);
        return total + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0);
      }, 0);
  const availablePackages = (production: ProductionBalance, exceptKey?: string, pointId?: string) => {
    if (!inventory) return remainingPackages(production, soldPackages(production) + reservedPackages(production.id, exceptKey));
    if (inventory.status !== "ready") return 0;
    const entry = entries.find((item) => item.key === exceptKey);
    if (entry && sale && canReclassifySale(sale, production.id, Number(entry.packages))) return sale.packages;
    const location = pointId ?? entries.find((entry) => entry.key === exceptKey)?.salePointId ?? "";
    const reservations = entries.filter((entry) => entry.key !== exceptKey).map((entry) => ({
      productionId: entry.productionId, salePointId: entry.salePointId || null, packages: Number(entry.packages),
      date: entry.date, pricePerPackage: 0, customer: "", paid: true, notes: "",
    }));
    return locationAvailable(inventory.data, production.id, location || null, sale, reservations);
  };
  const locationsReady = (!inventory || inventory.status === "ready") && (!points || points.status === "ready");
  const cartPackages = entries.reduce((total, entry) => {
    const quantity = Number(entry.packages);
    return total + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
  const canAddEntry = totalAvailable - cartPackages > 0;
  const amounts = entries.map(parseAmount);
  const total = amounts.reduce((sum, amount) => sum + amount.quantity * amount.price, 0);
  const validTotal = amounts.every((amount) => amount.valid) && Number.isFinite(total);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !locationsReady) return;
    const drafts: SaleDraft[] = [];
    for (const [index, entry] of entries.entries()) {
      const selected = known[entry.productionId];
      const { quantity, price, valid } = parseAmount(entry);
      if (!selected || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
        !Number.isFinite(new Date(`${entry.date}T12:00:00`).getTime()) ||
        !valid || entry.date < selected.date) {
        setActiveKey(entry.key);
        showErrorToast(`Confira os dados da venda ${index + 1}`, {
          description:
            "Selecione uma produção, informe uma data igual ou posterior à produção, uma quantidade inteira positiva e um preço válido.",
        });
        return;
      }
      const available = availablePackages(selected, entry.key);
      if (quantity > available) {
        setActiveKey(entry.key);
        showErrorToast("Estoque insuficiente para esta venda", {
          description: `A produção tem ${count(available)} pacotes disponíveis, considerando as outras vendas do carrinho. Reduza a quantidade ou escolha outra produção.`,
        });
        return;
      }
      drafts.push({
        id: sale?.id,
        productionId: entry.productionId,
        salePointId: entry.salePointId || null,
        date: entry.date,
        packages: quantity,
        pricePerPackage: entry.donated ? 0 : price,
        customer: entry.customer.trim(),
        paid: entry.donated || entry.paid,
        donated: entry.donated,
        notes: entry.notes.trim(),
      });
    }
    setIsSaving(true);
    try {
      const message = sale ? await onSave(drafts[0]) : await onSaveSales(drafts);
      // null means the workspace already handled cancellation or failure.
      if (message === null) return;
      if (message) {
        showErrorToast("Não foi possível salvar a venda", {
          description: message,
        });
      } else {
        toast.success(sale ? "Venda atualizada." : drafts.length === 1 ? "Venda registrada." : `${drafts.length} vendas registradas.`);
        onCancel();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <>
      {!isModal && <>
        <BackButton onClick={onCancel}>Voltar para vendas</BackButton>
        <PageHeader
          title={<>{sale ? "Editar venda" : "Registrar venda"}</>}
          eyebrow={<>VENDAS REALIZADAS</>}
        />
      </>}
      <FormLayout className={styles["sales-form"]} onSubmit={submit} noValidate>
        {(inventory?.status === "loading" || points?.status === "loading") && <LoadingState>Carregando disponibilidade por ponto...</LoadingState>}
        {(inventory?.status === "error" || points?.status === "error") && <EmptyState role="alert">Não foi possível carregar a disponibilidade por ponto. Recarregue a página antes de vender.</EmptyState>}
        <fieldset className={[styles["sales-cart"], !sale ? styles["sales-cart-layout"] : ""].filter(Boolean).join(" ")} disabled={isSaving}>
        {entries.map((entry, index) => {
          if (entry.key !== activeKey) return null;
          const selected = known[entry.productionId];
          const reclassifying = canReclassifySale(sale, entry.productionId, Number(entry.packages));
          const available = selected ? availablePackages(selected, entry.key) : 0;
          const amount = amounts[index];
          return <section key={entry.key} className={styles["sales-cart-entry"]} aria-label={`Venda ${index + 1}`}>
          {!sale && <div className={styles["sales-cart-header"]}>
            <h3>Venda {index + 1}</h3>
          </div>}
        <FormGrid className={styles["sales-form-fields"]}>
          <FormField className={styles["sales-production-field"]} label="Produção">
            
            <RemoteSelect
              required
              openOnFocus={!sale || !isModal}
              value={entry.productionId}
              placeholder="Selecione uma produção"
              selectedLabel={selected
                ? `${selected.recipeName} · ${dateLabel(selected.date)} · ${count(available)} disponíveis` : undefined}
              fetcher={queryService.balances}
              filters={{ available: true }}
              sortBy="date"
              descending
              toOption={(balance: ProductionBalance) => {
                // Prefer the copy already in the form so cart reservations are counted on the same totals.
                const production = known[balance.id] ?? balance;
                const left = remainingPackages(production, soldPackages(production) + reservedPackages(production.id, entry.key));
                return {
                  value: balance.id,
                  label: `${balance.recipeName} · ${dateLabel(balance.date)} · ${count(left)} disponíveis`,
                  disabled: left <= 0 && balance.id !== entry.productionId,
                };
              }}
              onChange={(id, balance) => {
                const production = balance ?? known[id];
                if (balance) setKnown((current) => ({ ...current, [balance.id]: current[balance.id] ?? balance }));
                updateEntry(entry.key, {
                  productionId: id,
                  ...(production && !entry.donated ? { price: priceText(production.expectedSalePrice ?? production.salePrice) } : {}),
                });
              }}
            />
          </FormField>
          <FormField label="Ponto de venda (opcional)">
            <SearchableSelect value={entry.salePointId} disabled={!locationsReady}
              placeholder="Sem ponto" selectedLabel={!entry.salePointId ? "Sem ponto" : undefined}
              options={[
                { value: "", label: reclassifying ? "Sem ponto"
                  : `Sem ponto · ${selected ? count(availablePackages(selected, entry.key, "")) : "0"} disponíveis` },
                ...(points?.status === "ready" ? points.data.filter((point) => point.id !== null).map((point) => ({
                  value: point.id!,
                  label: reclassifying ? point.name
                    : `${point.name} · ${selected ? count(availablePackages(selected, entry.key, point.id!)) : "0"} disponíveis`,
                })) : []),
              ]}
              onChange={(salePointId) => updateEntry(entry.key, { salePointId })} />
            <small>{reclassifying
              ? "Mantendo a produção e a quantidade, trocar o ponto apenas reclassifica a venda, sem alterar o estoque."
              : "Sem ponto vende apenas o saldo não distribuído. Selecione um ponto para usar o estoque dele."}</small>
          </FormField>
          <FormField label="Data da venda">
            
            <FormControl
              type="date"
              required
              value={entry.date}
              min={selected?.date || undefined}
              onChange={(event) => updateEntry(entry.key, { date: event.target.value })}
            />
          </FormField>
          <FormField label="Pacotes vendidos">
            
            <FormControl
              type="number"
              required
              min="1"
              max={available}
              step="1"
              value={entry.packages}
              onChange={(event) => updateEntry(entry.key, { packages: event.target.value })}
            />
            <small>{count(available)} disponíveis</small>
          </FormField>
          <FormField label="Preço real / pacote">
            
            <FormControl
              type="text"
              inputMode="decimal"
              required
              disabled={entry.donated}
              value={entry.price}
              onChange={(event) => updateEntry(entry.key, { price: event.target.value })}
              prefix="R$"
            />
          </FormField>
          <FormField label="Cliente (opcional)">
            
            <FormControl
              value={entry.customer}
              onChange={(event) => updateEntry(entry.key, { customer: event.target.value })}
            />
          </FormField>
          <div className={styles["sales-check-fields"]}>
            <label className={styles["sales-paid-field"]}>
              <input
                type="checkbox"
                checked={entry.donated || entry.paid}
                disabled={entry.donated}
                onChange={(event) => updateEntry(entry.key, { paid: event.target.checked })}
              />{" "}
              Valor recebido
            </label>
            <label className={styles["sales-paid-field"]}>
              <input
                type="checkbox"
                checked={entry.donated}
                onChange={(event) => {
                  const donated = event.target.checked;
                  updateEntry(entry.key, donated
                    ? { donated, price: "0", paid: true }
                    : { donated, price: priceText(selected?.expectedSalePrice ?? selected?.salePrice ?? 0) });
                }}
              />{" "}
              Doado
            </label>
          </div>
          <FormField className={styles["sales-notes-field"]} label="Observações (opcional)">
            
            <FormControl as="textarea"
              rows={3}
              value={entry.notes}
              onChange={(event) => updateEntry(entry.key, { notes: event.target.value })}
            />
          </FormField>
        </FormGrid>
          {!sale && <p className={styles["sales-cart-subtotal"]}>
            Total da venda: <strong>{amount.valid ? money(amount.quantity * amount.price) : "—"}</strong>
          </p>}
          </section>;
        })}
        {!sale && <aside className={styles["sales-cart-sidebar"]} aria-label="Carrinho de vendas">
          <h3>Carrinho · {entries.length} venda(s)</h3>
          <ul ref={cartListRef} className={styles["sales-cart-list"]}>
            {entries.map((entry, index) => {
              const amount = amounts[index];
              const production = known[entry.productionId];
              return <li key={entry.key} className={styles["sales-cart-item"]}>
                <Button variant="text" className={styles["sales-cart-select"]}
                  aria-label={`Editar venda ${index + 1}`}
                  aria-pressed={entry.key === activeKey}
                  onClick={() => setActiveKey(entry.key)}>
                  <strong>{entry.customer.trim() || "Cliente não informado"}</strong>
                  <span>{production?.recipeName || "Selecione uma produção"}</span>
                  <span>{entry.salePointId
                    ? (points?.status === "ready" ? points.data.find((point) => point.id === entry.salePointId)?.name : undefined) || "Ponto selecionado"
                    : "Sem ponto"}</span>
                  <span>{entry.donated ? "Doado" : amount.valid ? money(amount.quantity * amount.price) : "Valor inválido"} · {entry.packages || "—"} pacote(s)</span>
                  
                </Button>
                {entries.length > 1 && <Button variant="text" size="small"
                  aria-label={`Remover venda ${index + 1}`}
                  onClick={() => {
                    if (entry.key === activeKey)
                      setActiveKey(entries[index + 1]?.key ?? entries[index - 1].key);
                    setEntries((current) => current.filter((item) => item.key !== entry.key));
                  }}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>}
              </li>;
            })}
          </ul>
        <Button variant="secondary" disabled={!canAddEntry}
          onClick={() => {
            const activeEntry = entries.find((item) => item.key === activeKey) ?? entries[0];
            const activeProduction = known[activeEntry.productionId];
            const production = activeProduction && availablePackages(activeProduction, undefined, activeEntry.salePointId) > 0
              ? activeProduction
              : Object.values(known).find((item) => availablePackages(item, undefined, activeEntry.salePointId) > 0);
            const entry = {
              ...createEntry(production),
              date: activeEntry.date,
              salePointId: activeEntry.salePointId,
            };
            setEntries((current) => [...current, entry]);
            setActiveKey(entry.key);
            scrollCartToEnd.current = true;
          }}>
          <Plus size={17} aria-hidden="true" /> Adicionar outra venda
        </Button>
        {!canAddEntry && <p role="status">Não há mais pacotes disponíveis para adicionar outra venda.</p>}
        </aside>}
        </fieldset>
        <div className={styles["sales-form-footer"]}>
          <div>
            <span>{sale ? "Total da venda" : `Total do carrinho · ${entries.length} venda(s)`}</span>
            <strong>{validTotal ? money(total) : "—"}</strong>
          </div>
          <FormActions className={styles["sales-form-actions"]} onCancel={onCancel}
            disabled={isSaving || !locationsReady || !entries.every((entry) => entry.productionId)}
            cancelDisabled={isSaving}
            submitLabel={<><Check size={17} aria-hidden="true" /> {isSaving ? "Salvando..." : sale ? "Salvar venda" : "Confirmar vendas"}</>} />
        </div>
      </FormLayout>
    </>
  );
  return isModal ? (
    <RegistrationModal
      title={sale ? "Editar venda" : "Cadastrar vendas"}
      size={sale ? "default" : "wide"}
      busy={isSaving}
      onClose={() => { if (!isSaving) onCancel(); }}
    >
      {content}
    </RegistrationModal>
  ) : content;
}
