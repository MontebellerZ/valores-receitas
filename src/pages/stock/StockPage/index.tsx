import Button from "../../../components/ui/Button";
import SearchField from "../../../components/ui/SearchField";
import DataTable from "../../../components/ui/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import FormField from "../../../components/ui/FormField";
import FormActions from "../../../components/ui/FormActions";
import FormControl from "../../../components/ui/FormControl";
import StockEntryFields, { type StockItemRef } from "../../../components/stock/StockEntryFields";
import Pagination from "../../../components/ui/Pagination";
import type { ListControls } from "../../../hooks/usePagedQuery";
import styles from "./styles.module.scss";
import { useState } from "react";
import { toast } from "react-toastify";
import PageHeader from "../../../components/ui/PageHeader";
import RegistrationModal from "../../../components/ui/RegistrationModal";
import FormLayout, { FormGrid } from "../../../components/ui/FormLayout";
import Panel from "../../../components/ui/Panel";
import MetricCard from "../../../components/ui/MetricCard";
import Icon from "../../../components/ui/Icon";
import IconButton from "../../../components/ui/IconButton";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import type { StockEntry, StockLot, StockLotItem, StockCorrection, StockField, StockTotal } from "../../../domain/models";
import { localToday, money, number } from "../../../utils/format";


type Props = {
  /** Current page of lots, already filtered and ordered by the server. */
  lots: ListControls & { items: StockLotItem[] };
  /** Current page of remaining totals per market item, for the same filters. */
  totals: Omit<ListControls, "serverSort"> & { items: StockTotal[] };
  marketCount: number;
  search: string;
  onSearch: (search: string) => void;
  showInactive: boolean;
  onShowInactive: (show: boolean) => void;
  /** Explicit read of every lot of one purchase (up to 1.000) for the joint correction. */
  loadPurchase: (entryOrder: number) => Promise<StockLot[]>;
  addStock: (entry: StockEntry) => Promise<void>;
  adjustStock: (id: string, remaining: number, reason: string) => Promise<void>;
  updateStock: (correction: StockCorrection) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  disabled: boolean;
};

export default function StockPage({
  lots: lotPage, totals, marketCount, search, onSearch, showInactive, onShowInactive, loadPurchase,
  addStock, adjustStock, updateStock, deleteStock, disabled,
}: Props) {
  const [entry, setEntry] = useState<StockEntry & { packageCount: number }>({ marketItemId: "", entryDate: localToday(), packageCount: 1, packageQty: 1, packagePrice: 0 });
  const [entryItem, setEntryItem] = useState<StockItemRef>();
  const [adjustment, setAdjustment] = useState<{ id: string; remaining: number; max: number; reason: string; }>();
  const [busy, setBusy] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deleting, setDeleting] = useState<StockLot>();
  const [editing, setEditing] = useState<{
    lots: StockLot[]; value: StockEntry; item: StockItemRef; fields: Record<StockField, boolean>; reason: string;
  }>();
  const filtered = lotPage.items;
  const editPurchase = (lot: StockLotItem) => {
    setBusy(true);
    void loadPurchase(lot.entryOrder).then(openEdit).catch(() => {
      toast.error("Não foi possível carregar os pacotes desta compra.");
    }).finally(() => setBusy(false));
  };
  const openEdit = (lots: StockLot[]) => {
    if (!lots.length || lots.length > 1000) {
      toast.error("A correção permite de 1 a 1.000 pacotes da mesma compra.");
      return;
    }
    if (lots.some((lot) => lot.entryOrder !== lots[0].entryOrder || lot.marketItemId !== lots[0].marketItemId)) {
      toast.error("A edição conjunta permite apenas pacotes do mesmo insumo cadastrados na mesma compra.");
      return;
    }
    const { marketItemId, entryDate, packageQty, packagePrice } = lots[0];
    const single = lots.length === 1;
    setEditing({ lots, value: { marketItemId, entryDate, packageQty, packagePrice },
      item: { id: marketItemId, name: lots[0].itemName, unit: lots[0].unit },
      fields: { marketItemId: single, entryDate: single, packageQty: single, packagePrice: single }, reason: "" });
  };
  return <>
    <PageHeader title="Estoque" description="Registre cada pacote comprado. As produções consomem primeiro os lotes mais antigos (FIFO), usando o preço de cada compra."
      action={<Button disabled={disabled || busy || !marketCount} onClick={() => setIsAdding(true)}><Icon name="plus" size={17} /> Registrar compra</Button>} />
    {disabled && <p role="alert">Estoque indisponível para alterações. Recarregue a página para conectar ao servidor.</p>}
    <Panel title="Entrada de pacote">
      <p className={styles["formula-note"]}>Use “Registrar compra” para informar o insumo, a data e os dados do pacote.</p>
      <p className={styles["formula-note"]}>Cada entrada representa um pacote. Informe a quantidade na unidade do insumo e o preço pago; um mesmo insumo pode ter pacotes de tamanhos diferentes.</p>
    </Panel>
    <Panel title="Saldo disponível" action={<SearchField className={styles["stock-search"]} aria-label="Buscar no estoque" placeholder="Buscar insumo..." value={search} onChange={(event) => onSearch(event.target.value)} />}>
      <div className={styles["stock-toolbar"]}>
        <FormField variant="inline" label="Mostrar pacotes esgotados"><input type="checkbox" checked={showInactive} onChange={(event) => onShowInactive(event.target.checked)} /></FormField>
      </div>
      <p className={styles["formula-note"]}>“Editar compra” inclui todos os pacotes cadastrados juntos, mesmo os esgotados. Compras distintas não podem ser editadas em conjunto.</p>
      <div className={styles["stock-totals"]} aria-busy={totals.status === "loading"}>{totals.items.map((item) => <MetricCard variant="stock" key={item.id}
        label={item.name} value={<>{number(item.quantity, 4)} {item.unit}</>} />)}</div>
      {totals.status === "error" && <p role="alert">Não foi possível carregar os saldos por insumo.</p>}
      {totals.pagination.totalCount > 0 && <Pagination {...totals.pagination} label="saldos por insumo" />}
      <DataTable serverSort={lotPage.serverSort} aria-busy={lotPage.status === "loading"}><thead><tr><th>Insumo / lote</th><th>Compra</th><th>Qtd. comprada</th><th>Preço do pacote</th><th>Restante</th><th>Ações</th></tr></thead><tbody>{filtered.map((lot) => {
        const purchaseSize = lot.purchaseLotCount;
        const compatible = !lot.purchaseMixedItems;
        return <tr key={lot.id}>
          <td>{lot.itemName}<small className={styles["stock-lot-id"]}>{lot.id}</small></td><td>{lot.entryDate.split("-").reverse().join("/")}</td>
          <td>{number(lot.packageQty, 4)} {lot.unit}</td><td>{money(lot.packagePrice)}</td><td>{number(lot.remainingQty, 4)} {lot.unit}</td>
          <td><div className={styles["stock-actions"]}>
            <IconButton size="small" aria-label={`Editar pacote ${lot.id}`} title="Editar pacote" disabled={disabled || busy} onClick={() => openEdit([lot])}><Icon name="edit" size={16} /></IconButton>
            {purchaseSize > 1 && <IconButton size="small" aria-label={`Editar compra de ${purchaseSize} pacotes: ${lot.id}`}
              title={compatible ? `Editar compra (${purchaseSize} pacotes)` : "Compra com insumos diferentes: edite cada pacote individualmente"}
              disabled={disabled || busy || !compatible} onClick={() => editPurchase(lot)}><Icon name="editPurchase" size={16} /></IconButton>}
            <IconButton size="small" aria-label={`Dar baixa no pacote ${lot.id}`} title="Dar baixa / ajustar" disabled={disabled || busy || !lot.isActive} onClick={() => setAdjustment({ id: lot.id, remaining: lot.remainingQty, max: lot.remainingQty, reason: "" })}><Icon name="decrease" size={16} /></IconButton>
            <IconButton size="small" danger aria-label={`Excluir pacote ${lot.id}`} title="Excluir pacote" disabled={disabled || busy} onClick={() => setDeleting(lot)}><Icon name="trash" size={16} /></IconButton>
          </div></td>
        </tr>;
      })}</tbody></DataTable>
      {lotPage.status === "error" ? <EmptyState>Não foi possível carregar os pacotes do estoque.</EmptyState>
        : !filtered.length && lotPage.status === "ready" && <EmptyState>Nenhum pacote encontrado. Registre uma compra ou ajuste os filtros.</EmptyState>}
      <Pagination {...lotPage.pagination} label="pacotes" />
      <p className={styles["formula-note"]}>Lotes com saldo zero ficam inativos automaticamente. Somente pacotes sem consumo, baixa ou correção podem ser excluídos; os demais preservam seu histórico.</p>
    </Panel>
    {isAdding && <RegistrationModal title="Cadastrar entrada no estoque" busy={busy} onClose={() => setIsAdding(false)}>
      <FormLayout disabled={disabled || busy} onSubmit={(event) => {
        event.preventDefault();
        if (!Number.isInteger(entry.packageCount) || entry.packageCount < 1 || entry.packageCount > 2147483647) {
          toast.error("Informe uma quantidade inteira e positiva de pacotes.");
          return;
        }
        setBusy(true);
        void addStock(entry).then(() => {
          toast.success(entry.packageCount === 1 ? "Pacote adicionado ao estoque." : `${number(entry.packageCount)} pacotes adicionados ao estoque.`);
          setIsAdding(false);
          setEntry({ marketItemId: "", entryDate: localToday(), packageCount: 1, packageQty: 1, packagePrice: 0 });
          setEntryItem(undefined);
        }).finally(() => setBusy(false)).catch(() => { /* The workspace reports API errors. */ });
      }}>
        <StockEntryFields value={entry} selectedItem={entryItem} disabled={disabled || busy} onChange={(patch, item) => {
          setEntry({ ...entry, ...patch });
          if (item) setEntryItem(item);
        }} />
        <p className={styles["formula-note"]}>Será criado um registro por pacote, com a quantidade e o preço informados acima. Valor total: {money(entry.packageCount * entry.packagePrice)}.</p>
        <FormActions onCancel={() => setIsAdding(false)} disabled={disabled || busy} cancelDisabled={disabled || busy} submitLabel={busy ? "Cadastrando..." : "Cadastrar"} />
      </FormLayout>
    </RegistrationModal>}
    {editing && <RegistrationModal title={`Corrigir ${editing.lots.length === 1 ? "pacote" : `${editing.lots.length} pacotes`}`} busy={busy} onClose={() => setEditing(undefined)}>
      <FormLayout disabled={disabled || busy} onSubmit={(event) => {
        event.preventDefault();
        if (!Object.values(editing.fields).some(Boolean)) {
          toast.error("Marque pelo menos um campo para alterar.");
          return;
        }
        if (!editing.reason.trim()) {
          toast.error("Informe o motivo da correção.");
          return;
        }
        const correction: StockCorrection = { lotIds: editing.lots.map((lot) => lot.id), reason: editing.reason.trim(),
          ...(editing.fields.marketItemId ? { marketItemId: editing.value.marketItemId } : {}),
          ...(editing.fields.entryDate ? { entryDate: editing.value.entryDate } : {}),
          ...(editing.fields.packageQty ? { packageQty: editing.value.packageQty } : {}),
          ...(editing.fields.packagePrice ? { packagePrice: editing.value.packagePrice } : {}),
        };
        setBusy(true);
        void updateStock(correction).then(() => {
          setEditing(undefined);
          toast.success("Correção salva em todos os pacotes da edição.");
        }).finally(() => setBusy(false)).catch(() => { /* The workspace reports API errors and preserves this draft. */ });
      }}>
        <p className={styles["formula-note"]}>Somente os campos marcados serão aplicados a todos os {editing.lots.length} pacotes. Os demais dados serão preservados, mesmo quando diferentes entre os pacotes.</p>
        <StockEntryFields value={editing.value} selectedItem={editing.item} disabled={disabled || busy} enabledFields={editing.fields}
          onToggleField={(field, enabled) => setEditing({ ...editing, fields: { ...editing.fields, [field]: enabled } })}
          onChange={(patch, item) => setEditing({ ...editing, value: { ...editing.value, ...patch }, item: item ?? editing.item })} />
        <FormField label="Motivo da correção"><FormControl required as="textarea" maxLength={500} value={editing.reason}
          onChange={(event) => setEditing({ ...editing, reason: event.target.value })} /></FormField>
        <p className={styles["formula-note"]}>O novo saldo preserva todas as saídas já registradas. O preço corrigido vale para os próximos consumos; custos de produções e vendas anteriores não mudam. Pacotes usados em produção não podem trocar de insumo. Quantidade de pacotes não é alterada: registre compras faltantes, exclua pacotes extras sem movimentações ou dê baixa nos que possuem histórico.</p>
        <Panel title="Pacotes que serão corrigidos" variant="inset">
          <DataTable variant="compact"><thead><tr><th>Pacote</th><th>Preço atual → novo</th><th>Saldo atual → novo</th></tr></thead><tbody>
            {editing.lots.map((lot) => {
              const remaining = (editing.fields.packageQty ? editing.value.packageQty : lot.packageQty) - (lot.packageQty - lot.remainingQty);
              const unit = editing.fields.marketItemId && editing.item.id === editing.value.marketItemId ? editing.item.unit : lot.unit;
              return <tr key={lot.id}><td data-sort-value={lot.itemName}>{lot.itemName}<small className={styles["stock-lot-id"]}>{lot.id}{!lot.isActive && " (esgotado)"}</small></td>
                <td data-sort-value={lot.packagePrice}>{money(lot.packagePrice)} → {money(editing.fields.packagePrice ? editing.value.packagePrice : lot.packagePrice)}</td>
                <td data-sort-value={lot.remainingQty}>{number(lot.remainingQty, 4)} {lot.unit} → {number(remaining, 4)} {unit}{remaining < 0 && " — quantidade menor que as saídas"}</td></tr>;
            })}
          </tbody></DataTable>
        </Panel>
        <FormActions onCancel={() => setEditing(undefined)} disabled={disabled || busy || !Object.values(editing.fields).some(Boolean)}
          cancelDisabled={busy} submitLabel={busy ? "Salvando..." : `Salvar correção (${editing.lots.length})`} />
      </FormLayout>
    </RegistrationModal>}
    {adjustment && <RegistrationModal title="Baixa do pacote" busy={busy} onClose={() => setAdjustment(undefined)}>
      <FormLayout disabled={disabled || busy} onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void adjustStock(adjustment.id, adjustment.remaining, adjustment.reason).then(() => {
          setAdjustment(undefined);
          toast.success("Baixa registrada.");
        }).finally(() => setBusy(false)).catch(() => { /* The workspace reports API errors. */ });
      }}>
        <FormGrid variant="wrap">
          <FormField label="Quantidade restante (zero para baixa total)"><FormControl autoFocus type="number" required min="0" step="0.0001" max={adjustment.max} value={adjustment.remaining} onChange={(event) => setAdjustment({ ...adjustment, remaining: Number(event.target.value) })} /></FormField>
          <FormField label="Motivo da baixa"><FormControl required maxLength={500} value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></FormField>
        </FormGrid>
        <FormActions onCancel={() => setAdjustment(undefined)} disabled={disabled || busy} cancelDisabled={disabled || busy} submitLabel={busy ? "Salvando..." : "Salvar baixa"} />
      </FormLayout>
    </RegistrationModal>}
    <ConfirmDeleteDialog pendingDelete={deleting ? { kind: "stock", id: deleting.id, label: `${deleting.itemName} — ${deleting.id}` } : null}
      busy={busy} onCancel={() => setDeleting(undefined)} onConfirm={() => {
        if (!deleting || disabled || busy) return;
        setBusy(true);
        void deleteStock(deleting.id).then(() => {
          setDeleting(undefined);
          toast.success("Pacote excluído do estoque.");
        }).finally(() => setBusy(false)).catch(() => { /* The workspace reports API errors and preserves the confirmation. */ });
      }} />
  </>;
}
