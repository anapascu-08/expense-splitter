"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth-actions";

type Props = {
  mode: "login" | "register";
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
};

const inputClass =
  "field";

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined
  );
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {isRegister && (
        <label className="flex flex-col gap-1 text-sm">
          Nume
          <input name="name" type="text" required className={inputClass} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Parolă
        <input
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 8 : undefined}
          className={inputClass}
        />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {pending
          ? "Se procesează…"
          : isRegister
            ? "Creează cont"
            : "Autentifică-te"}
      </button>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {isRegister ? (
          <>
            Ai deja cont?{" "}
            <Link href="/login" className="underline">
              Autentifică-te
            </Link>
          </>
        ) : (
          <>
            Nu ai cont?{" "}
            <Link href="/register" className="underline">
              Creează unul
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
