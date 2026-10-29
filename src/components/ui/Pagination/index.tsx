import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES, type PageSize } from "../../../domain/models";
import { number } from "../../../utils/format";
import IconButton from "../IconButton";
import SearchableSelect from "../SearchableSelect";
import styles from "./styles.module.scss";

type Props = {
  page: number;
  pageSize: PageSize;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  busy?: boolean;
  label?: string;
};

const pageSizeOptions = PAGE_SIZES.map((size) => ({ value: String(size), label: `${size} por página` }));

/** Server-side page navigation with the page sizes allowed by the API (10, 25, 50 or 100). */
export default function Pagination({
  page, pageSize, totalCount, totalPages, onPageChange, onPageSizeChange, busy = false, label = "registros",
}: Props) {
  const first = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(totalCount, page * pageSize);
  return (
    <nav className={styles.pagination} aria-label={`Paginação de ${label}`} aria-busy={busy}>
      <span className={styles.range} aria-live="polite">
        {totalCount === 0 ? `0 ${label}` : `${number(first)}–${number(last)} de ${number(totalCount)} ${label}`}
      </span>
      <span className={styles.controls}>
        <SearchableSelect controlSize="compact" className={styles.size} aria-label="Itens por página"
          value={String(pageSize)} options={pageSizeOptions}
          onChange={(value) => onPageSizeChange(Number(value) as PageSize)} />
        <span className={styles.navigation}>
          <IconButton size="small" aria-label="Página anterior" disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} aria-hidden="true" /></IconButton>
          <span className={styles.position}>Página {number(Math.min(page, Math.max(totalPages, 1)))} de {number(Math.max(totalPages, 1))}</span>
          <IconButton size="small" aria-label="Próxima página" disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}><ChevronRight size={16} aria-hidden="true" /></IconButton>
        </span>
      </span>
    </nav>
  );
}
