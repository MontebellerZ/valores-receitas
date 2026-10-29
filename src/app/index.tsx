import { lazy, Suspense } from "react";
import { useSession } from "../hooks/useSession";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getLoginDestination, paths } from "./paths";
const Workspace = lazy(() => import("./Workspace"));
const AuthPage = lazy(() => import("../pages/auth/AuthPage"));
const OverviewRoute = lazy(() => import("./routes/OverviewRoute"));
const RecipesRoute = lazy(() => import("./routes/RecipesRoute"));
const RecipeDetailRoute = lazy(() => import("./routes/RecipeDetailRoute"));
const ProductionsRoute = lazy(() => import("./routes/ProductionsRoute"));
const ProductionDetailRoute = lazy(() => import("./routes/ProductionDetailRoute"));
const MarketRoute = lazy(() => import("./routes/MarketRoute"));
const StockRoute = lazy(() => import("./routes/StockRoute"));
const SalesRoute = lazy(() => import("./routes/SalesRoute"));
const NotFoundPage = lazy(() => import("../pages/not-found/NotFoundPage"));


export default function App() {
  const { session, sessionChecked, handleAuthenticated, signOut } =
    useSession();
  const location = useLocation();
  if (!sessionChecked)
    return (
      <main  role="status">
        Verificando sessão...
      </main>
    );
  const search = new URLSearchParams(location.search);
  const confirmingEmail =
    search.has("confirmUserId") && search.has("confirmToken");
  if (location.pathname === paths.overview && confirmingEmail) {
    return <Navigate to={`${paths.login}${location.search}`} replace />;
  }

  const authenticationPage =
    session && !confirmingEmail ? (
      <Navigate to={getLoginDestination(location.state?.from)} replace />
    ) : (
      <AuthPage onAuthenticated={handleAuthenticated} />
    );

  return (
    <Suspense fallback={<main role="status">Carregando tela...</main>}>
      <Routes>
        <Route path={paths.login} element={authenticationPage} />
        <Route path={paths.register} element={authenticationPage} />
        <Route
          element={
            session ? (
              <Workspace key={session.id} session={session} signOut={signOut} />
            ) : (
              <Navigate
                to={`${paths.login}${location.search}`}
                replace
                state={{
                  from: `${location.pathname}${location.search}${location.hash}`,
                }}
              />
            )
          }
        >
          <Route index element={<OverviewRoute />} />
          <Route path={paths.recipes} element={<RecipesRoute />} />
          <Route path={paths.recipePattern} element={<RecipeDetailRoute />} />
          <Route path={paths.productions} element={<ProductionsRoute />} />
          <Route
            path={paths.productionPattern}
            element={<ProductionDetailRoute />}
          />
          <Route path={paths.market} element={<MarketRoute />} />
          <Route path="/mercado" element={<Navigate to={paths.market} replace />} />
          <Route path={paths.stock} element={<StockRoute />} />
          <Route path={paths.sales} element={<SalesRoute />} />
          <Route path={paths.saleNew} element={<SalesRoute />} />
          <Route path={paths.saleEditPattern} element={<SalesRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
