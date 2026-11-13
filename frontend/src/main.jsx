import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./index.css";
import { ToastProvider } from "./components/ui/Toast";
import { Button } from "./components/ui/Button";
import { EmptyState } from "./components/ui/EmptyState";
import { Page, SiteLayout } from "./layouts/SiteLayout";
import { getUser } from "./lib/api";
import { homeFor } from "./lib/format";

// Cada ruta es su propio trozo de JS: solo se descarga la pantalla que se visita.
const Landing = lazy(() => import("./pages/Landing"));
const Branches = lazy(() => import("./pages/Branches"));
const BranchDetail = lazy(() => import("./pages/BranchDetail"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Recover = lazy(() => import("./pages/Recover"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

/* Ruta protegida: sin sesión va a /login (y vuelve después); con otro rol, a su panel. */
function RequireRole({ role, children }) {
  const user = getUser();
  const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <SiteLayout>
      <Page>
        <EmptyState art="restaurantes" title="Esta página no existe" action={<Button to="/">Volver al inicio</Button>}>
          Puede que el enlace esté mal escrito o que la página se haya movido.
        </EmptyState>
      </Page>
    </SiteLayout>
  );
}

function RouteFallback() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <span className="sr-only">Cargando…</span>
      <span className="size-10 animate-spin rounded-full border-4 border-rojo-100 border-t-rojo-600" aria-hidden="true" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sedes" element={<Branches />} />
            <Route path="/sedes/:id" element={<BranchDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<Recover />} />
            <Route path="/cliente" element={<RequireRole role="CLIENT"><ClientDashboard /></RequireRole>} />
            <Route path="/admin" element={<RequireRole role="RESTAURANT_ADMIN"><AdminDashboard /></RequireRole>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}

async function start() {
  // `npm run dev:demo`: datos de ejemplo en memoria para ver el front sin backend.
  // En el build de producción esta rama se elimina.
  if (import.meta.env.DEV && import.meta.env.MODE === "demo") {
    const { installDemoApi } = await import("./lib/demo");
    installDemoApi();
  }
  createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
}
start();
