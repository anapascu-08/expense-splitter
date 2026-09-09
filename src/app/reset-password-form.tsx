"use client";

import { useActionState, useId } from "react";
import type { AuthState } from "@/app/auth-actions";
import { SubmitButton } from "@/app/submit-button";

type Props = {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  token: string;
};

export function ResetPasswordForm({ action, token }: Props) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    action,
    undefined
  );
  const errorId = useId();
  const invalid =
    state?.field === "password"
      ? { "aria-invalid": true as const, "aria-describedby": errorId }
      : {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
        Parolă nouă
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field"
          {...invalid}
        />
      </label>

      {state?.error && (
        <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <SubmitButton variant="primary" pendingLabel="Se salvează…">
        Salvează parola
      </SubmitButton>
    </form>
  );
}
