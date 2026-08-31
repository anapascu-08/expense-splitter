// Shown while the group page's data is loading on first navigation.
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-800 ${className}`}
    />
  );
}

export default function GroupLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-3">
        <Bar className="h-4 w-32" />
        <Bar className="h-8 w-56" />
      </div>
      {[0, 1, 2].map((s) => (
        <section key={s} className="flex flex-col gap-3">
          <Bar className="h-5 w-40" />
          <Bar className="h-14 w-full" />
          <Bar className="h-14 w-full" />
        </section>
      ))}
      <span className="sr-only">Se încarcă grupul…</span>
    </main>
  );
}
