import { Skeleton } from '../ui/skeleton';

type PageSkeletonProps = {
  view?: string;
};

function ProductCards({ count = 6, featured = false }: { count?: number; featured?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`overflow-hidden rounded-2xl border border-gray-100 bg-white ${featured && i === 0 ? 'col-span-2' : ''}`}>
          <div className={`relative overflow-hidden ${featured && i === 0 ? 'aspect-[16/7]' : 'aspect-[4/3]'}`}>
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            {featured && i === 0 && <Skeleton className="absolute bottom-3 left-3 h-3 w-1/3 rounded-full bg-white/35" />}
          </div>
          {(!featured || i !== 0) && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-3.5 w-4/5 rounded-full" />
              <Skeleton className="h-2.5 w-2/5 rounded-full" />
              <Skeleton className="h-2.5 w-1/3 rounded-full" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RouteHeader({ titleWidth = 'w-40', subtitleWidth = 'w-64' }: { titleWidth?: string; subtitleWidth?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-6 ${titleWidth} rounded-full`} />
      <Skeleton className={`h-3 ${subtitleWidth} rounded-full`} />
    </div>
  );
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 pb-24 pt-6" aria-label="Chargement de l'accueil">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <RouteHeader titleWidth="w-36" subtitleWidth="w-48" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="overflow-hidden rounded-[28px] bg-gray-200 shadow-lg">
          <Skeleton className="h-[220px] w-full rounded-none md:h-[340px]" />
        </div>
        <Skeleton className="h-12 w-full rounded-[14px]" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-white p-3 shadow-sm">
              <Skeleton className="mb-3 h-10 w-10 rounded-xl" />
              <Skeleton className="h-3 w-3/4 rounded-full" />
              <Skeleton className="mt-2 h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        <section className="space-y-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <ProductCards count={6} featured />
        </section>
        <section className="space-y-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="overflow-hidden rounded-2xl border border-gray-100">
                <Skeleton className="aspect-[16/9] h-auto w-full rounded-none" />
                <div className="space-y-2 p-2.5"><Skeleton className="h-2 w-14 rounded-full" /><Skeleton className="h-3 w-3/4 rounded-full" /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProductsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24" aria-label="Chargement des produits">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-4 pb-10 pt-6">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-2xl bg-white/20" />
          <div className="space-y-2"><Skeleton className="h-5 w-32 rounded-full bg-white/35" /><Skeleton className="h-2.5 w-48 rounded-full bg-white/20" /></div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4">
        <div className="-mt-5 mb-6 flex gap-1 overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-lg">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 min-w-[90px] flex-1 rounded-xl" />)}
        </div>
        <div className="mb-4 flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-36 rounded-full" /><Skeleton className="h-2.5 w-44 rounded-full" /></div></div>
        <ProductCards />
      </div>
    </div>
  );
}

function FormationsPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#faf9f6] pb-24" aria-label="Chargement des formations">
      <div className="border-b border-stone-200/70 bg-white px-4 pb-5 pt-8 text-center">
        <Skeleton className="mx-auto h-2.5 w-36 rounded-full bg-orange-100" />
        <Skeleton className="mx-auto mt-3 h-9 w-64 rounded-full" />
        <Skeleton className="mx-auto mt-3 h-3 w-72 max-w-full rounded-full" />
        <Skeleton className="mx-auto mt-5 h-12 w-full max-w-lg rounded-full" />
      </div>
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5 overflow-hidden border-b border-stone-200 pb-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-4 w-14 shrink-0 rounded-full" />)}</div>
        <div className="flex items-center justify-between"><Skeleton className="h-5 w-44 rounded-full" /><Skeleton className="h-3 w-16 rounded-full" /></div>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white"><Skeleton className="aspect-[16/10] h-auto w-full rounded-none" /><div className="space-y-2 p-3"><Skeleton className="h-2 w-16 rounded-full bg-orange-100" /><Skeleton className="h-3 w-4/5 rounded-full" /><Skeleton className="h-2.5 w-3/5 rounded-full" /></div></div>)}
        </div>
      </div>
    </div>
  );
}

function ShippingPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-12" aria-label="Chargement de l'expédition">
      <div className="space-y-3 text-center"><Skeleton className="mx-auto h-9 w-72 rounded-full" /><Skeleton className="mx-auto h-4 w-96 max-w-full rounded-full" /></div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {[1, 2].map(i => <div key={i} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"><Skeleton className="aspect-video h-auto w-full rounded-none" /><div className="space-y-3 p-6"><Skeleton className="h-6 w-40 rounded-full" /><Skeleton className="h-3 w-full rounded-full" /><Skeleton className="h-3 w-4/5 rounded-full" /><Skeleton className="mt-3 h-10 w-full rounded-md" /></div></div>)}
      </div>
    </div>
  );
}

function TrackingPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50" aria-label="Chargement du suivi de colis">
      <div className="relative overflow-hidden bg-gray-800 px-4 py-20">
        <div className="relative z-10 mx-auto max-w-4xl space-y-10 text-center"><Skeleton className="mx-auto h-12 w-[min(600px,90%)] rounded-full bg-white/20" /><Skeleton className="mx-auto h-5 w-[min(560px,85%)] rounded-full bg-white/15" /><div className="rounded-2xl bg-white/15 p-8"><div className="flex flex-col gap-4 sm:flex-row"><Skeleton className="h-14 flex-1 rounded-2xl bg-white/25" /><Skeleton className="h-14 w-full rounded-2xl bg-white/25 sm:w-44" /></div></div></div>
      </div>
    </div>
  );
}

function CardsPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#effaff] px-4 pb-24 pt-6" aria-label="Chargement des cartes">
      <div className="mx-auto max-w-2xl space-y-5"><div className="flex items-center justify-between"><Skeleton className="h-7 w-32 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" /></div><Skeleton className="aspect-[1.6/1] w-full rounded-[1.75rem] bg-blue-200" /><div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(i => <div key={i} className="space-y-2"><Skeleton className="h-2.5 w-14 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>)}</div><div className="grid grid-cols-3 gap-2.5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div><Skeleton className="h-14 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>
    </div>
  );
}

/**
 * Route-aware fallback used while lazy routes are being fetched.
 * The app's main shell already provides the global navigation and top padding,
 * so these variants only model the page content that is about to appear.
 */
export function PageSkeleton({ view = 'home' }: PageSkeletonProps) {
  if (view === 'home') return <HomePageSkeleton />;
  if (view === 'products') return <ProductsPageSkeleton />;
  if (view === 'formations') return <FormationsPageSkeleton />;
  if (view === 'services') return <ServicesPageSkeleton />;
  if (view === 'shipping') return <ShippingPageSkeleton />;
  if (view === 'tracking') return <TrackingPageSkeleton />;
  if (view === 'cards' || view === 'wallet') return <CardsPageSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-24 pt-6" aria-label="Chargement de la page">
      <div className="mx-auto max-w-3xl space-y-4">
        <RouteHeader />
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><Skeleton className="mb-5 h-5 w-32 rounded-full" /><div className="space-y-4">{[1, 2, 3, 4, 5].map(i => <div key={i} className="flex items-center gap-3"><Skeleton className="h-10 w-10 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/5 rounded-full" /><Skeleton className="h-2.5 w-1/3 rounded-full" /></div><Skeleton className="h-4 w-16 rounded-full" /></div>)}</div></div>
      </div>
    </div>
  );
}

function ServicesPageSkeleton() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#f8fafc]" aria-label="Chargement des services">
      <div className="bg-white px-5 pb-8 pt-7 sm:px-8 sm:pt-10"><div className="mx-auto flex max-w-5xl items-center justify-between gap-5"><div className="space-y-3"><Skeleton className="h-10 w-56 rounded-xl" /><Skeleton className="h-5 w-64 rounded-full" /></div><Skeleton className="hidden h-32 w-48 rounded-[2rem] sm:block" /></div></div>
      <div className="mx-auto max-w-3xl space-y-4 px-5 pt-1 sm:px-8"><Skeleton className="h-24 w-full rounded-[1.45rem] bg-[#101d34]" />{[1, 2, 3, 4].map(i => <div key={i} className="flex min-h-[112px] items-center gap-3 rounded-[1.45rem] border border-slate-100 bg-white p-3 shadow-sm sm:gap-4 sm:p-4"><Skeleton className="h-12 w-12 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3 rounded-full" /><Skeleton className="h-3 w-full max-w-[255px] rounded-full" /><Skeleton className="h-3 w-28 rounded-full" /></div><Skeleton className="h-20 w-20 shrink-0 rounded-[1.2rem]" /></div>)}</div>
    </div>
  );
}