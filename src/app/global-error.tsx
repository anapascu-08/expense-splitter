"use client";

import { useEffect } from "react";

// Catches errors thrown from the root layout itself, where the normal error.tsx
// (which renders inside the layout) can't. It replaces <html>, so it carries
// its own minimal inline styling — globals.css may not have loaded.
export default function GlobalError({
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
    <html lang="ro">
      <body
        style={{
          margin: 0,
          padding: "4rem 1rem",
          maxWidth: "24rem",
          marginInline: "auto",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.5,
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Ceva n-a mers
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#52525b" }}>
          A apărut o eroare neașteptată.
        </p>
        <button type="button" onClick={reset} style={{ marginTop: "0.5rem" }}>
          Reîncearcă
        </button>
      </body>
    </html>
  );
}
