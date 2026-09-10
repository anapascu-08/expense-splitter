"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Ceva n-a mers</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        A apărut o eroare neașteptată. Încearcă din nou; dacă persistă, revino
        mai târziu.
      </p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Reîncearcă
        </button>
        <Link href="/" className="btn">
          ← Grupurile tale
        </Link>
      </div>
    </main>
  );
}
