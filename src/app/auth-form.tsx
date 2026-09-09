"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import type { AuthState } from "@/app/auth-actions";

type Props = {
  mode: "login" | "register";
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  // login only: forwarded to the action as a hidden field so it can redirect
  // there on success (see `login` in auth-actions.ts).
  next?: string;
};

const inputClass =
  "field";

export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined
  );
  const errorId = useId();
  const isRegister = mode === "register";

  const withNext = (path: string) =>
    next ? `${path}?next=${encodeURIComponent(next)}` : path;

  const invalidFields = new Set(
    state?.field
      ? Array.isArray(state.field)
        ? state.field
        : [state.field]
      : []
  );
  const invalid = (name: string) =>
    invalidFields.has(name)
      ? { "aria-invalid": true as const, "aria-describedby": errorId }
      : {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      {isRegister && (
        <label className="flex flex-col gap-1 text-sm">
          Nume
          <input
            name="name"
            type="text"
            required
            className={inputClass}
            {...invalid("name")}
          />
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
          {...invalid("email")}
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
          {...invalid("password")}
        />
      </label>

      {!isRegister && (
        <Link
          href={withNext("/forgot-password")}
          className="self-end text-xs text-gray-500 hover:underline dark:text-gray-400"
        >
          Ai uitat parola?
        </Link>
      )}

      {state?.error && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
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
            <Link href={withNext("/login")} className="underline">
              Autentifică-te
            </Link>
          </>
        ) : (
          <>
            Nu ai cont?{" "}
            <Link href={withNext("/register")} className="underline">
              Creează unul
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
