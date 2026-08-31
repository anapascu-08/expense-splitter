"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/app/submit-button";
import type { FormState } from "@/app/form-state";

type Props = {
  fromId: string;
  toId: string;
  amount: string; // baniToInput string
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

// "marchează achitat" on a settlement row — records the exact transfer as a
// payment. Its values are always valid, but it shares addPayment with the
// manual form, so it needs the (state, formData) signature and surfaces any
// error inline just in case.
export function QuickPayForm({ fromId, toId, amount, action }: Props) {
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined
  );
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="fromId" value={fromId} />
      <input type="hidden" name="toId" value={toId} />
      <input type="hidden" name="amount" value={amount} />
      <SubmitButton
        pendingLabel="…"
        className="whitespace-nowrap rounded-md border border-gray-300 px-2 py-1 text-xs font-medium transition hover:border-gray-400 disabled:opacity-50 dark:border-gray-700 dark:hover:border-gray-500"
      >
        marchează achitat
      </SubmitButton>
      {state && "error" in state && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
