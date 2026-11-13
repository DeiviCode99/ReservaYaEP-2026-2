import clsx from "clsx";

export function Skeleton({ className }) {
  return <span aria-hidden="true" className={clsx("block animate-pulse rounded-lg bg-tinta/10", className)} />;
}

/* Envoltura accesible: anuncia "cargando" una sola vez para todo el bloque. */
export function Loading({ label = "Cargando…", className, children }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function BranchCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-tinta/8 bg-papel">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function TicketSkeleton() {
  return (
    <div className="rounded-3xl border border-tinta/8 bg-papel p-5">
      <div className="flex justify-between gap-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-8 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-6 h-9 w-full rounded-full" />
    </div>
  );
}
