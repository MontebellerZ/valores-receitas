import { useState, type FormEvent } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import type { Resource } from "../../../hooks/useResource";
import type { SalePointAllocation, SalePointInventory, SalePointSummary } from "../../../domain/models";
import { groupInventoryByRecipe, transferAllocations, validateAllocations } from "../../../domain/salePoints";
import { money, number as count, dateLabel, localToday } from "../../../utils/format";
import { showErrorToast } from "../../../components/ui/Notifications/toast";
import PageHeader from "../../../components/ui/PageHeader";
import Panel from "../../../components/ui/Panel";
import Button, { ButtonLink } from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import LoadingState from "../../../components/ui/LoadingState";
import RegistrationModal from "../../../components/ui/RegistrationModal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import FormLayout, { FormGrid } from "../../../components/ui/FormLayout";
import FormField from "../../../components/ui/FormField";
import FormControl from "../../../components/ui/FormControl";
import FormActions from "../../../components/ui/FormActions";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import { paths } from "../../../app/paths";
import styles from "./styles.module.scss";

type Props = {
  points: Resource<SalePointSummary[]>;
  inventory: Resource<SalePointInventory[]>;
  range: { from: string; to: string };
  onRangeChange: (range: { from: string; to: string }) => void;
  canManage: boolean;
  onSave: (point: { id?: string; name: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAllocate: (id: string, allocations: SalePointAllocation[]) => Promise<void>;
};

export default function SalePointsPage({ points, inventory, range, onRangeChange, canManage, onSave, onDelete, onAllocate }: Props) {
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<SalePointSummary | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SalePointSummary | null>(null);
  const [distribution, setDistribution] = useState<{
    productionId: string; recipeName: string; sourcePointId: string | null;
    available: number; destinationId: string; packages: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = inventory.status === "ready" ? inventory.data : [];
  const locations = points.status === "ready" ? points.data : [];
  const registered = locations.filter((point): point is SalePointSummary & { id: string } => point.id !== null);
  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || busy) return;
    if (!editing.name.trim()) {
      showErrorToast("Informe o nome do ponto de venda.");
      return;
    }
    setBusy(true);
    try { await onSave(editing); setEditing(null); toast.success("Ponto de venda salvo."); }
    catch { /* Workspace preserves the form and reports API failures. */ }
    finally { setBusy(false); }
  };
  const saveDistribution = async (event: FormEvent) => {
    event.preventDefault();
    if (!distribution || busy) return;
    const packages = Number(distribution.packages);
    if (!distribution.destinationId) {
      showErrorToast("Revise a transferência", { description: "Escolha um ponto e informe uma quantidade inteira disponível." });
      return;
    }
    const destinationPointId = distribution.destinationId === UNASSIGNED_VALUE ? null : distribution.destinationId;
    const allocations = transferAllocations(rows, distribution.productionId, distribution.sourcePointId,
      destinationPointId, packages, registered.map((point) => point.id));
    if (!allocations) {
      showErrorToast("Revise a transferência", { description: "Informe uma quantidade inteira disponível e um ponto diferente do local atual." });
      return;
    }
    const error = validateAllocations(allocations, rows.filter((item) => item.productionId === distribution.productionId)
      .reduce((total, item) => total + item.packages, 0));
    if (error) { showErrorToast("Revise a transferência", { description: error }); return; }
    setBusy(true);
    try { await onAllocate(distribution.productionId, allocations); setDistribution(null); toast.success("Transferência atualizada."); }
    catch { /* Keep the destination and quantity for another attempt. */ }
    finally { setBusy(false); }
  };
  const openDistribution = (row: SalePointInventory) => {
    setDistribution({
      productionId: row.productionId, recipeName: row.recipeName, sourcePointId: row.salePointId,
      available: row.packages, destinationId: "", packages: String(Math.min(1, row.packages)),
    });
  };
  const destinationOptions = distribution ? [
    ...(distribution.sourcePointId !== null ? [{ value: UNASSIGNED_VALUE, label: "Sem ponto" }] : []),
    ...registered.filter((point) => point.id !== distribution.sourcePointId)
      .map((point) => ({ value: point.id, label: point.name })),
  ] : [];
  return <div className={styles.sections}>
    <PageHeader title="Pontos de venda" eyebrow="DISTRIBUIÇÃO E RESULTADOS"
      action={<Button disabled={!canManage} onClick={() => setEditing({ name: "" })}>Cadastrar ponto</Button>} />
    <Panel title="Comparação de vendas e faturamento" description="O período filtra as vendas e doações. O estoque disponível sempre mostra o saldo atual.">
      <FormGrid>
        <FormField label="Vendas desde"><FormControl type="date" value={range.from} max={range.to || localToday()}
          onChange={(event) => onRangeChange({ ...range, from: event.target.value })} /></FormField>
        <FormField label="Vendas até"><FormControl type="date" value={range.to} min={range.from || undefined} max={localToday()}
          onChange={(event) => onRangeChange({ ...range, to: event.target.value })} /></FormField>
      </FormGrid>
      {points.status === "loading" && <LoadingState>Carregando pontos de venda...</LoadingState>}
      {points.status === "error" && <EmptyState role="alert">Não foi possível carregar os pontos de venda. Recarregue a página.</EmptyState>}
      {points.status === "ready" && <DataTable defaultSort={{ column: 4, direction: "descending" }}>
        <thead><tr><th>Ponto</th><th>Disponíveis agora</th><th>Vendidos</th><th>Doados</th><th>Faturamento</th><th>Custo das saídas</th><th>Ações</th></tr></thead>
        <tbody>{locations.map((point) => <tr key={point.id ?? "unassigned"}>
          <td data-sort-value={point.name}>{point.name}</td>
          <td data-sort-value={point.availablePackages}>{count(point.availablePackages)}</td>
          <td data-sort-value={point.soldPackages}>{count(point.soldPackages)}</td>
          <td data-sort-value={point.donatedPackages}>{count(point.donatedPackages)}</td>
          <td data-sort-value={point.revenue}>{money(point.revenue)}</td>
          <td data-sort-value={point.cost}>{money(point.cost)}</td>
          <td>{point.id !== null && <div className={styles.actions}>
            <IconButton title="Editar ponto" aria-label={`Editar ponto ${point.name}`} disabled={!canManage}
              onClick={() => setEditing({ id: point.id!, name: point.name })}><Pencil size={16} /></IconButton>
            <IconButton danger title="Excluir ponto" aria-label={`Excluir ponto ${point.name}`} disabled={!canManage}
              onClick={() => setDeleting(point)}><Trash2 size={16} /></IconButton>
          </div>}</td>
        </tr>)}</tbody>
      </DataTable>}
    </Panel>
    <Panel title="Estoque por ponto" description="Distribua ou transfira os pacotes disponíveis. Pacotes não distribuídos ficam em Sem ponto; vendas já registradas não mudam.">
      {inventory.status === "loading" && <LoadingState>Carregando estoque por ponto...</LoadingState>}
      {inventory.status === "error" && <EmptyState role="alert">Não foi possível carregar o estoque. Recarregue a página.</EmptyState>}
      {inventory.status === "ready" && points.status === "ready" && <div className={styles["point-cards"]}>
        {locations.map((point) => {
          const recipes = groupInventoryByRecipe(rows, point.id);
          return <Button key={point.id ?? "unassigned"} variant="secondary" className={styles["point-card"]}
            aria-label={`Ver estoque de ${point.name}`} onClick={() => { setDistribution(null); setSelectedLocation(point); }}>
            <span className={styles["point-card-heading"]}>{point.name}<ChevronRight size={16} aria-hidden="true" /></span>
            {recipes.length ? <span className={styles["point-card-recipes"]}>{recipes.map((recipe) =>
              <span key={recipe.recipeName}><span>{recipe.recipeName}</span><strong>{count(recipe.packages)}</strong></span>)}</span>
              : <span className={styles["point-card-empty"]}>Nenhum item disponível</span>}
          </Button>;
        })}
      </div>}
      {points.status === "ready" && !registered.length && <EmptyState>Vendas diretas continuam disponíveis em Sem ponto.</EmptyState>}
    </Panel>
    {editing && <RegistrationModal title={editing.id ? "Editar ponto de venda" : "Cadastrar ponto de venda"} busy={busy} onClose={() => setEditing(null)}>
      <FormLayout onSubmit={saveName} disabled={busy}>
        <FormField label="Nome"><FormControl required autoFocus value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></FormField>
        <FormActions onCancel={() => setEditing(null)} disabled={busy || !canManage} cancelDisabled={busy} submitLabel="Salvar ponto" />
      </FormLayout>
    </RegistrationModal>}
    {selectedLocation && <RegistrationModal title={distribution
      ? `Transferir · ${distribution.recipeName}` : `Estoque · ${selectedLocation.name}`}
      busy={busy} onClose={() => { setDistribution(null); setSelectedLocation(null); }}>
      {!distribution ? (() => {
        const stock = rows.filter((item) => item.salePointId === selectedLocation.id);
        return stock.length ? <DataTable><thead><tr><th>Produção</th><th>Data</th><th>Pacotes</th><th>Ações</th></tr></thead>
          <tbody>{stock.map((row) => <tr key={row.productionId}>
            <td data-sort-value={row.recipeName}>{row.recipeName}</td>
            <td data-sort-value={row.date}>{dateLabel(row.date)}</td>
            <td data-sort-value={row.packages}>{count(row.packages)}</td>
            <td><div className={styles.actions}>
              <Button variant="secondary" size="small" disabled={!canManage || !destinationOptionsFor(row, registered).length}
                onClick={() => openDistribution(row)}>{row.salePointId === null ? "Distribuir" : "Transferir"}</Button>
              <ButtonLink variant="secondary" size="small" to={paths.production(row.productionId)}>Ver produção</ButtonLink>
            </div></td>
          </tr>)}</tbody></DataTable> : <EmptyState>Nenhum pacote disponível neste local.</EmptyState>;
      })() : <FormLayout onSubmit={saveDistribution} disabled={busy}>
        <p className={styles["formula-note"]}>{count(distribution.available)} pacotes de {distribution.recipeName} disponíveis para transferir.</p>
        <FormGrid>
          <FormField label="Ponto de destino">
            <SearchableSelect aria-label="Ponto de destino" required value={distribution.destinationId}
              placeholder="Selecione um ponto" options={destinationOptions}
              onChange={(destinationId) => setDistribution({ ...distribution, destinationId })} />
          </FormField>
          <FormField label="Quantidade de pacotes">
            <FormControl type="number" min="1" max={distribution.available} step="1" required
              value={distribution.packages}
              onChange={(event) => setDistribution({ ...distribution, packages: event.target.value })} />
          </FormField>
        </FormGrid>
        <FormActions onCancel={() => setDistribution(null)} disabled={busy || !canManage || !destinationOptions.length}
          cancelDisabled={busy} submitLabel={busy ? "Salvando..." : "Confirmar transferência"} />
      </FormLayout>}
    </RegistrationModal>}
    <ConfirmDeleteDialog pendingDelete={deleting?.id ? { kind: "salePoint", id: deleting.id, label: deleting.name } : null}
      busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => {
        if (!deleting?.id || busy || !canManage) return;
        setBusy(true);
        void onDelete(deleting.id).then(() => { setDeleting(null); toast.success("Ponto excluído."); })
          .catch(() => {}).finally(() => setBusy(false));
      }} />
  </div>;
}

const UNASSIGNED_VALUE = "__sem_ponto__";

function destinationOptionsFor(row: SalePointInventory, points: (SalePointSummary & { id: string })[]) {
  return [
    ...(row.salePointId !== null ? [{ value: UNASSIGNED_VALUE, label: "Sem ponto" }] : []),
    ...points.filter((point) => point.id !== row.salePointId).map((point) => ({ value: point.id, label: point.name })),
  ];
}
