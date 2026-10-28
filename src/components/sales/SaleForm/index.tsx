import FormActions from "../../ui/FormActions";
import FormLayout, { FormGrid } from "../../ui/FormLayout";
import FormField from "../../ui/FormField";
import FormControl from "../../ui/FormControl";
import SearchableSelect from "../../ui/SearchableSelect";
import styles from "./styles.module.scss";
import PageHeader from "../../ui/PageHeader";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import Button from "../../ui/Button";
import BackButton from "../../ui/BackButton";
import { toast } from "react-toastify";
import type { Sale, SaleDraft, SalesProduction } from "../../../domain/models";
import { remainingPackages } from "../../../domain/calculations";
import RegistrationModal from "../../ui/RegistrationModal";
import {
  money,
  number as count,
  dateLabel,
  localToday as today,
  makeId,
} from "../../../utils/format";

type Props = {
  productions: SalesProduction[];
  sales: Sale[];
  onSave: (draft: SaleDraft) => Promise<string | undefined | null>;
  onSaveSales: (drafts: SaleDraft[]) => Promise<string | undefined | null>;
};

const priceText = (value: number) => String(value).replace(".", ",");

type SaleEntry = {
  key: string;
  productionId: string;
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
  productions,
  sales,
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
  const soldPackages = (id: string) =>
    sales
      .filter((entry) => entry.productionId === id && entry.id !== sale?.id)
      .reduce((total, entry) => total + entry.packages, 0);
  const createEntry = (production?: SalesProduction, existing?: Sale): SaleEntry => ({
    key: makeId(),
    productionId: existing?.productionId ?? production?.id ?? "",
    date: existing?.date ?? today(),
    packages: String(existing?.packages ?? 1),
    price: priceText(existing?.pricePerPackage ?? production?.expectedSalePrice ?? production?.salePrice ?? 0),
    customer: existing?.customer ?? "",
    paid: existing?.paid ?? true,
    donated: existing?.donated ?? false,
    notes: existing?.notes ?? "",
  });
  const [entries, setEntries] = useState<SaleEntry[]>(() => [
    createEntry(productions.find((production) => remainingPackages(production, soldPackages(production.id)) > 0), sale),
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
  const availablePackages = (production: SalesProduction, exceptKey?: string) =>
    remainingPackages(production, soldPackages(production.id) + reservedPackages(production.id, exceptKey));
  const nextProduction = productions.find((production) => availablePackages(production) > 0);
  const amounts = entries.map(parseAmount);
  const total = amounts.reduce((sum, amount) => sum + amount.quantity * amount.price, 0);
  const validTotal = amounts.every((amount) => amount.valid) && Number.isFinite(total);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const drafts: SaleDraft[] = [];
    for (const [index, entry] of entries.entries()) {
      const selected = productions.find((production) => production.id === entry.productionId);
      const { quantity, price, valid } = parseAmount(entry);
      if (!selected || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
        !Number.isFinite(new Date(`${entry.date}T12:00:00`).getTime()) ||
        !valid || entry.date < selected.date) {
        setActiveKey(entry.key);
        toast.error(`Venda ${index + 1}: selecione uma produção, uma data igual ou posterior à produção, uma quantidade inteira positiva e um preço válido.`);
        return;
      }
      const available = availablePackages(selected, entry.key);
      if (quantity > available) {
        setActiveKey(entry.key);
        toast.error(`Venda ${index + 1}: esta produção tem apenas ${count(available)} pacotes disponíveis, considerando as outras vendas do carrinho.`);
        return;
      }
      drafts.push({
        id: sale?.id,
        productionId: entry.productionId,
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
        toast.error(message);
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
        <fieldset className={[styles["sales-cart"], !sale ? styles["sales-cart-layout"] : ""].filter(Boolean).join(" ")} disabled={isSaving}>
        {entries.map((entry, index) => {
          if (entry.key !== activeKey) return null;
          const selected = productions.find((production) => production.id === entry.productionId);
          const available = selected ? availablePackages(selected, entry.key) : 0;
          const amount = amounts[index];
          return <section key={entry.key} className={styles["sales-cart-entry"]} aria-label={`Venda ${index + 1}`}>
          {!sale && <div className={styles["sales-cart-header"]}>
            <h3>Venda {index + 1}</h3>
          </div>}
        <FormGrid className={styles["sales-form-fields"]}>
          <FormField className={styles["sales-production-field"]} label="Produção">
            
            <SearchableSelect
              required
              value={entry.productionId}
              placeholder="Selecione uma produção"
              onChange={(id) => {
                const production = productions.find(
                  (entry) => entry.id === id,
                );
                updateEntry(entry.key, {
                  productionId: id,
                  ...(production && !entry.donated ? { price: priceText(production.expectedSalePrice ?? production.salePrice) } : {}),
                });
              }}
              options={productions
                // Keeps the current selection visible even if it has no packages left.
                .filter((production) => production.id === entry.productionId || availablePackages(production, entry.key) > 0)
                .map((production) => ({
                  value: production.id,
                  label: `${production.recipeName} · ${dateLabel(production.date)} · ${count(availablePackages(production, entry.key))} disponíveis`,
                }))}
            />
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
              const production = productions.find((item) => item.id === entry.productionId);
              return <li key={entry.key} className={styles["sales-cart-item"]}>
                <Button variant="text" className={styles["sales-cart-select"]}
                  aria-label={`Editar venda ${index + 1}`}
                  aria-pressed={entry.key === activeKey}
                  onClick={() => setActiveKey(entry.key)}>
                  <strong>{entry.customer.trim() || "Cliente não informado"}</strong>
                  <span>{production?.recipeName || "Selecione uma produção"}</span>
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
        <Button variant="secondary" disabled={!nextProduction}
          onClick={() => {
            const activeEntry = entries.find((item) => item.key === activeKey) ?? entries[0];
            const activeProduction = productions.find((item) => item.id === activeEntry.productionId);
            const production = activeProduction && availablePackages(activeProduction) > 0
              ? activeProduction
              : nextProduction;
            const entry = {
              ...createEntry(production),
              date: activeEntry.date,
            };
            setEntries((current) => [...current, entry]);
            setActiveKey(entry.key);
            scrollCartToEnd.current = true;
          }}>
          <Plus size={17} aria-hidden="true" /> Adicionar outra venda
        </Button>
        {!nextProduction && <p role="status">Não há mais pacotes disponíveis para adicionar outra venda.</p>}
        </aside>}
        </fieldset>
        <div className={styles["sales-form-footer"]}>
          <div>
            <span>{sale ? "Total da venda" : `Total do carrinho · ${entries.length} venda(s)`}</span>
            <strong>{validTotal ? money(total) : "—"}</strong>
          </div>
          <FormActions className={styles["sales-form-actions"]} onCancel={onCancel}
            disabled={isSaving || !entries.every((entry) => entry.productionId)}
            cancelDisabled={isSaving}
            submitLabel={<><Check size={17} aria-hidden="true" /> {isSaving ? "Salvando..." : sale ? "Salvar venda" : "Confirmar vendas"}</>} />
        </div>
      </FormLayout>
    </>
  );
  return isModal ? (
    <RegistrationModal
      title={sale ? "Editar venda" : "Cadastrar vendas"}
      className={!sale ? styles["sales-cart-modal"] : undefined}
      busy={isSaving}
      onClose={() => { if (!isSaving) onCancel(); }}
    >
      {content}
    </RegistrationModal>
  ) : content;
}
