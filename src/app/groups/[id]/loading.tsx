// Shown while the group page's data is loading on first navigation. Mirrors
// the real page's structure (single column, then 1fr + 320px sidebar at lg)
// so the layout doesn't jump when the content arrives.
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-800 ${className}`}
    />
  );
}

function Section() {
  return (
    <section className="flex flex-col gap-3">
      <Bar className="h-5 w-40" />
      <Bar className="h-14 w-full" />
      <Bar className="h-14 w-full" />
    </section>
  );
}

export default function GroupLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 lg:max-w-6xl">
      <div className="flex flex-col gap-3">
        <Bar className="h-4 w-32" />
        <Bar className="h-8 w-56" />
      </div>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <Section />
          <Section />
        </div>
        <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="card flex flex-col gap-3 p-4">
            <Bar className="h-5 w-32" />
            <Bar className="h-10 w-full" />
            <Bar className="h-10 w-full" />
          </div>
        </aside>
        <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-2">
          <Section />
        </div>
      </div>

      <span className="sr-only">Se încarcă grupul…</span>
    </main>
  );
}
