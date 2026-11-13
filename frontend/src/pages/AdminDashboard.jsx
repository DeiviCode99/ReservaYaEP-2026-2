import { useCallback, useState } from "react";
import clsx from "clsx";
import { ClipboardList, Store } from "lucide-react";
import { Page, SiteLayout } from "../layouts/SiteLayout";
import { getUser } from "../lib/api";
import { invalidateAdminBranches } from "../lib/notifications";
import { ReservationsTab } from "./admin/ReservationsTab";
import { RestaurantsTab } from "./admin/RestaurantsTab";

const TABS = [
  { id: "reservas", label: "Reservas", icon: ClipboardList },
  { id: "restaurantes", label: "Restaurantes y sedes", icon: Store },
];

export default function AdminDashboard() {
  const user = getUser();
  const [tab, setTab] = useState("reservas");
  const [branchesVersion, setBranchesVersion] = useState(0);

  // Al guardar un restaurante o una sede cambian el filtro de sedes y la campanita.
  const onBranchesChanged = useCallback(() => {
    invalidateAdminBranches();
    setBranchesVersion((version) => version + 1);
  }, []);

  return (
    <SiteLayout>
      <Page>
        <header>
          <p className="font-semibold text-piedra-700">Hola, {user.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold text-rojo-700 sm:text-4xl">Tu restaurante en ReservaYa</h1>
          <p className="mt-2 max-w-2xl text-piedra-700">Responde las reservas de tus sedes, registra tu marca y define horarios y aforo.</p>
        </header>

        <div role="tablist" aria-label="Secciones del panel" className="mt-7 flex max-w-full gap-1 overflow-x-auto rounded-full border border-tinta/10 bg-papel p-1 sm:inline-flex">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={clsx(
                "inline-flex h-10 flex-1 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold whitespace-nowrap transition duration-150",
                tab === item.id ? "bg-rojo-600 text-white" : "text-piedra-700 hover:bg-tinta/5 hover:text-tinta",
              )}
            >
              <item.icon size={17} aria-hidden="true" /> {item.label}
            </button>
          ))}
        </div>

        {/* Ambas pestañas quedan montadas: cambiar de una a otra no pierde filtros ni formularios. */}
        <section id="panel-reservas" role="tabpanel" aria-labelledby="tab-reservas" hidden={tab !== "reservas"} className="mt-6">
          <ReservationsTab branchesVersion={branchesVersion} />
        </section>
        <section id="panel-restaurantes" role="tabpanel" aria-labelledby="tab-restaurantes" hidden={tab !== "restaurantes"} className="mt-6">
          <RestaurantsTab onBranchesChanged={onBranchesChanged} />
        </section>
      </Page>
    </SiteLayout>
  );
}
