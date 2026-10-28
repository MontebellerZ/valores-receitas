import IconButton from "../../ui/IconButton";
import Button from "../../ui/Button";
import styles from "./styles.module.scss";
import type { ReactNode } from "react";
import { LogOut, ShoppingBag } from "lucide-react";
import { Link, NavLink, useLocation, useMatch } from "react-router-dom";
import { paths } from "../../../app/paths";
import type { SyncStatus, UserSession } from "../../../domain/models";
import logoHorizontal from "../../../assets/brand/conta-de-chef-horizontal.png";
import logoSymbol from "../../../assets/brand/conta-de-chef-symbol.png";
import Icon from "../../ui/Icon";

type Props = {
  session: UserSession;
  apiStatus: SyncStatus;
  recipeCount: number;
  productionCount: number;
  salesCount: number;
  marketCount: number;
  children: ReactNode;
  signOut: () => void;
  exportWorkbook: () => void;
  hasUnsavedChanges: boolean;
};

export default function AppLayout({
  session,
  apiStatus,
  recipeCount,
  productionCount,
  salesCount,
  marketCount,
  children,
  signOut,
  exportWorkbook,
  hasUnsavedChanges,
}: Props) {
  const { pathname } = useLocation();
  const recipeDetail = useMatch(paths.recipePattern);
  const productionDetail = useMatch(paths.productionPattern);
  const saleEdit = useMatch(paths.saleEditPattern);
  const saleNew = pathname === paths.saleNew;
  const section =
    pathname === paths.overview
      ? "Visão geral"
      : pathname === paths.recipes || recipeDetail
        ? "Receitas"
        : pathname === paths.productions || productionDetail
          ? "Produção"
          : pathname === paths.sales || saleEdit || saleNew
            ? "Vendas"
            : pathname === paths.market
              ? "Insumos"
              : pathname === paths.stock ? "Estoque" : "Página não encontrada";
  const navClassName = ({ isActive }: { isActive: boolean }) =>
    isActive ? styles["nav-item"] + " " + styles["active"] : styles["nav-item"];

  return (
    <div className={styles["app-shell"]}>
      <aside className={styles["sidebar"]}>
        <Link
          className={styles["brand"]}
          to={paths.overview}
          aria-label="Conta de Chef, início"
        >
          <img
            className={styles["brand-logo-horizontal"]}
            src={logoHorizontal}
            alt=""
            width="624"
            height="194"
          />
          <img
            className={styles["brand-logo-symbol"]}
            src={logoSymbol}
            alt=""
            width="462"
            height="478"
          />
        </Link>
        <div className={styles["workspace-label"]}>ESPAÇO DE TRABALHO</div>
        <nav className={styles["main-nav"]} aria-label="Navegação principal">
          <NavLink className={navClassName} to={paths.overview} end>
            <Icon name="overview" /> Visão geral
          </NavLink>
          <NavLink className={navClassName} to={paths.recipes}>
            <Icon name="recipe" /> Receitas{" "}
            <span className={styles["nav-count"]}>{recipeCount}</span>
          </NavLink>
          <NavLink className={navClassName} to={paths.productions}>
            <Icon name="chart" /> Produção{" "}
            <span className={styles["nav-count"]}>{productionCount}</span>
          </NavLink>
          <NavLink className={navClassName} title="Vendas" to={paths.sales}>
            <ShoppingBag size={18} aria-hidden="true" /> Vendas{" "}
            <span className={styles["nav-count"]}>{salesCount}</span>
          </NavLink>
          <NavLink className={navClassName} to={paths.market}>
            <Icon name="market" /> Insumos{" "}
            <span className={styles["nav-count"]}>{marketCount}</span>
          </NavLink>
          <NavLink className={navClassName} to={paths.stock}>
            <Icon name="package" /> Estoque
          </NavLink>
        </nav>
        <div className={styles["sidebar-bottom"]}>
          <div className={styles["sync-status"]}>
            <span
              className={[
                styles["status-dot"],
                apiStatus === "error"
                  ? styles["is-error"]
                  : apiStatus === "saving" || apiStatus === "connecting"
                    ? styles["is-saving"]
                    : "",
              ].filter(Boolean).join(" ")}
            />
            <div>
              <strong>
                {apiStatus === "connecting"
                  ? "Conectando à API"
                  : apiStatus === "saving"
                    ? "Salvando dados"
                    : apiStatus === "error"
                      ? "Falha ao salvar"
                      : hasUnsavedChanges
                        ? "Alterações não salvas"
                        : "Dados salvos"}
              </strong>
              <small>
                {apiStatus === "error"
                  ? "alterações mantidas na tela"
                  : hasUnsavedChanges
                    ? "clique em Salvar alterações"
                    : "SQL Server"}
              </small>
            </div>
          </div>
          <div className={styles["profile"]}>
            <div className={styles["avatar"]}>
              {session.email.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong title={session.email}>{session.email}</strong>
              <small>Conta pessoal</small>
            </div>
            <IconButton
              
              title="Sair da conta"
              aria-label="Sair da conta"
              onClick={() => void signOut()}
            >
              <LogOut size={16} aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </aside>
      <main className={styles["main-content"]}>
        <header className={styles["topbar"]}>
          <div className={styles["breadcrumb"]}>
            Painel <span>/</span> {section}
            {(recipeDetail || productionDetail) && (
              <>
                <span>/</span> Detalhes
              </>
            )}
            {(saleEdit || saleNew) && (
              <>
                <span>/</span> {saleEdit ? "Editar venda" : "Registrar venda"}
              </>
            )}
          </div>
          <div className={styles["topbar-actions"]}>
            <Button variant="text" onClick={exportWorkbook}>
              <Icon name="download" size={16} /> Exportar Excel
            </Button>
          </div>
        </header>
        <div className={styles["page-wrap"]}>{children}</div>
      </main>
    </div>
  );
}

