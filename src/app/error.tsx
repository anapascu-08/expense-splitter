"use client";

import { useEffect } from "react";
import { BackLink } from "@/app/back-link";

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
      <div className="flex items-center gap-4">
        <button type="button" onClick={reset} className="btn-primary">
          Reîncearcă
        </button>
        <BackLink href="/">Grupurile tale</BackLink>
      </div>
    </main>
  );
}
